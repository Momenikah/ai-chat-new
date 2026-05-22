package handlers

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// NoteHandler exposes internal-note endpoints.
type NoteHandler struct {
	notes *services.NoteService
}

// NewNoteHandler constructs a NoteHandler.
func NewNoteHandler(notes *services.NoteService) *NoteHandler {
	return &NoteHandler{notes: notes}
}

type createNoteRequest struct {
	Body string `json:"body" validate:"required,max=4000"`
}

// List handles GET /conversations/:id/notes.
func (h *NoteHandler) List(c echo.Context) error {
	list, err := h.notes.List(c.Request().Context(), middleware.ConversationID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal memuat catatan")
	}
	return utils.OK(c, map[string]any{"notes": list})
}

// Create handles POST /conversations/:id/notes.
func (h *NoteHandler) Create(c echo.Context) error {
	var req createNoteRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	note, err := h.notes.Create(c.Request().Context(),
		middleware.ConversationID(c), middleware.UserID(c), req.Body)
	if err != nil {
		if errors.Is(err, services.ErrEmptyNote) {
			return utils.Error(c, http.StatusUnprocessableEntity,
				"empty_note", "Catatan tidak boleh kosong")
		}
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal menyimpan catatan")
	}
	return utils.Created(c, note)
}
