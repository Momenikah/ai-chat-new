package utils

import (
	"strings"

	"github.com/go-playground/validator/v10"
)

// Validator wraps go-playground/validator and is registered on Echo.
type Validator struct {
	v *validator.Validate
}

// NewValidator constructs a Validator.
func NewValidator() *Validator {
	return &Validator{v: validator.New()}
}

// Validate implements echo.Validator.
func (val *Validator) Validate(i interface{}) error {
	return val.v.Struct(i)
}

// FieldErrors converts a validator error into a field->message map,
// suitable for the API's ValidationError response.
func FieldErrors(err error) map[string]string {
	out := map[string]string{}
	verrs, ok := err.(validator.ValidationErrors)
	if !ok {
		return out
	}
	for _, fe := range verrs {
		field := strings.ToLower(fe.Field())
		out[field] = messageFor(fe)
	}
	return out
}

func messageFor(fe validator.FieldError) string {
	switch fe.Tag() {
	case "required":
		return "Field ini wajib diisi"
	case "email":
		return "Format email tidak valid"
	case "min":
		return "Minimal " + fe.Param() + " karakter"
	case "max":
		return "Maksimal " + fe.Param() + " karakter"
	default:
		return "Nilai tidak valid"
	}
}
