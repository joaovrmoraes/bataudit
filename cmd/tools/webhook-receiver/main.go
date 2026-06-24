// webhook-receiver is a tiny local HTTP server for debugging BatAudit webhooks.
// It logs every incoming request (method, path, headers, body) and returns the
// status code you ask for (default 200), so you can point a BatAudit webhook at
// it and see exactly what gets delivered.
//
// Usage:
//
//	go run ./cmd/tools/webhook-receiver               # listens on :9099, returns 200
//	PORT=8000 STATUS=500 go run ./cmd/tools/webhook-receiver
//
// Then create a webhook in BatAudit pointing at http://<this-host>:9099 and hit
// "Test". Watch this terminal for the payload and headers (incl. the HMAC
// signature header X-BatAudit-Signature).
package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"
)

func main() {
	port := getenv("PORT", "9099")
	status, _ := strconv.Atoi(getenv("STATUS", "200"))
	if status == 0 {
		status = 200
	}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		_ = r.Body.Close()

		fmt.Printf("\n──────────────────────────────────────────────\n")
		fmt.Printf("%s  %s %s\n", time.Now().Format("15:04:05"), r.Method, r.URL.Path)
		fmt.Printf("From: %s\n", r.RemoteAddr)
		fmt.Println("Headers:")
		for k, v := range r.Header {
			fmt.Printf("  %s: %s\n", k, v)
		}
		fmt.Printf("Body (%d bytes):\n%s\n", len(body), string(body))
		fmt.Printf("→ responding %d\n", status)

		w.WriteHeader(status)
		_, _ = w.Write([]byte(fmt.Sprintf(`{"received":true,"status":%d}`, status)))
	})

	addr := ":" + port
	log.Printf("webhook-receiver listening on %s (returns HTTP %d)", addr, status)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
