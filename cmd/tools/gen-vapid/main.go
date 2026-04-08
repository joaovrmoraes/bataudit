// gen-vapid generates a VAPID key pair for Web Push notifications.
// Run once and add the output to your .env file.
//
// Usage:
//
//	go run ./cmd/tools/gen-vapid
package main

import (
	"fmt"
	"os"

	"github.com/joaovrmoraes/bataudit/internal/notification"
)

func main() {
	pub, priv, err := notification.GenerateVAPIDKeys()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("VAPID_PUBLIC_KEY=%s\n", pub)
	fmt.Printf("VAPID_PRIVATE_KEY=%s\n", priv)
	fmt.Printf("VAPID_SUBJECT=mailto:admin@yourdomain.com\n")
}
