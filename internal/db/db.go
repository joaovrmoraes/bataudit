package db

import (
	"fmt"

	"github.com/go-playground/validator/v10"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	_ "modernc.org/sqlite"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func RunMigrations(config *Database) error {
	var dsn string
	switch config.Driver {
	case "postgres":
		dsn = fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
			config.User, config.Password, config.Host, config.Port, config.Name)
	case "sqlite":
		dsn = "sqlite3://" + config.SQLitePath
	default:
		return fmt.Errorf("driver não suportado: %s", config.Driver)
	}

	m, err := migrate.New(
		"file://internal/db/migrations",
		dsn,
	)
	if err != nil {
		return err
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return err
	}
	return nil
}

func Init() *gorm.DB {
	config := LoadConfig()

	validate := validator.New()
	if err := validate.Struct(config); err != nil {
		fmt.Printf("Validation error: %v\n", err)
		panic("Invalid database configuration")
	}

	if err := RunMigrations(&config); err != nil {
		fmt.Printf("Migration error: %v\n", err)
		panic("Failed to run migrations")
	}

	var db *gorm.DB
	var err error

	switch config.Driver {
	case "postgres":
		dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable",
			config.Host, config.User, config.Password, config.Name, config.Port)
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err != nil {
			fmt.Printf("Failed to connect to Postgres: %v\n", err)
			panic(err)
		}
	case "sqlite":
		db, err = gorm.Open(sqlite.Open("file:"+config.SQLitePath+"?_pragma=foreign_keys(1)"), &gorm.Config{})
		if err != nil {
			fmt.Printf("Failed to connect to SQLite: %v\n", err)
			panic(err)
		}
	default:
		fmt.Printf("Driver database not supported: %s\n", config.Driver)
		panic("Unsupported database driver")
	}

	fmt.Printf("Using database driver: %s\n", config.Driver)
	return db
}
