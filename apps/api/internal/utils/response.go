package utils

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

// ErrorResponse is the canonical error body returned by the API.
type ErrorResponse struct {
	Error   string            `json:"error"`
	Message string            `json:"message"`
	Details map[string]string `json:"details,omitempty"`
}

// JSON writes a success payload with the given status code.
func JSON(c echo.Context, status int, payload interface{}) error {
	return c.JSON(status, payload)
}

// OK writes a 200 response.
func OK(c echo.Context, payload interface{}) error {
	return c.JSON(http.StatusOK, payload)
}

// Created writes a 201 response.
func Created(c echo.Context, payload interface{}) error {
	return c.JSON(http.StatusCreated, payload)
}

// Error writes a structured error response.
func Error(c echo.Context, status int, code, message string) error {
	return c.JSON(status, ErrorResponse{Error: code, Message: message})
}

// ValidationError writes a 422 response with per-field details.
func ValidationError(c echo.Context, details map[string]string) error {
	return c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
		Error:   "validation_failed",
		Message: "Beberapa field tidak valid",
		Details: details,
	})
}
