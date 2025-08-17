package db

import (
	"os"

	"github.com/joho/godotenv"
)

type DatabaseDriver string

const (
	Postgres DatabaseDriver = "postgres"
	SQLite   DatabaseDriver = "sqlite"
)

type Database struct {
	Driver     DatabaseDriver `validate:"required"`
	User       string         `validate:"required_if=Driver postgres"`
	Password   string         `validate:"required_if=Driver postgres"`
	Name       string         `validate:"required_if=Driver postgres"`
	Host       string         `validate:"required_if=Driver postgres"`
	Port       string         `validate:"required_if=Driver postgres"`
	SQLitePath string         `validate:"required_if=Driver sqlite"`
}

func LoadConfig() Database {
	godotenv.Load()
	return Database{
		Driver:     DatabaseDriver(os.Getenv("DB_DRIVER")),
		User:       os.Getenv("DB_USER"),
		Password:   os.Getenv("DB_PASSWORD"),
		Name:       os.Getenv("DB_NAME"),
		Host:       os.Getenv("DB_HOST"),
		Port:       os.Getenv("DB_PORT"),
		SQLitePath: os.Getenv("SQLITE_PATH"),
	}
}
