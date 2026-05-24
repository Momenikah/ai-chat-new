package handlers

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// ContactHandler exposes CRM contact endpoints.
type ContactHandler struct {
	contacts *services.ContactService
}

// NewContactHandler constructs a ContactHandler.
func NewContactHandler(c *services.ContactService) *ContactHandler {
	return &ContactHandler{contacts: c}
}

type createContactRequest struct {
	Name     string   `json:"name" validate:"required,min=1,max=120"`
	Phone    *string  `json:"phone" validate:"omitempty,max=32"`
	Email    *string  `json:"email" validate:"omitempty,email"`
	Location *string  `json:"location" validate:"omitempty,max=120"`
	Company  *string  `json:"company" validate:"omitempty,max=120"`
	Birthday *string  `json:"birthday" validate:"omitempty"`
	Notes    *string  `json:"notes" validate:"omitempty,max=4000"`
	TagIDs   []string `json:"tag_ids"`
}

type updateContactRequest struct {
	Name     string  `json:"name" validate:"required,min=1,max=120"`
	Phone    *string `json:"phone" validate:"omitempty,max=32"`
	Email    *string `json:"email" validate:"omitempty,email"`
	Location *string `json:"location" validate:"omitempty,max=120"`
	Company  *string `json:"company" validate:"omitempty,max=120"`
	Birthday *string `json:"birthday" validate:"omitempty"`
	Notes    *string `json:"notes" validate:"omitempty,max=4000"`
}

type mergeContactRequest struct {
	TargetID string `json:"target_id" validate:"required,uuid"`
}

type attachTagRequest struct {
	TagID string `json:"tag_id" validate:"required,uuid"`
}

// List handles GET /workspaces/:id/contacts.
func (h *ContactHandler) List(c echo.Context) error {
	q := c.QueryParams()
	filter := repositories.ListFilter{
		WorkspaceID: middleware.WorkspaceID(c),
		Search:      q.Get("search"),
	}
	if v := q.Get("channel"); v != "" {
		ct := models.ChannelType(v)
		if ct.Valid() {
			filter.ChannelType = &ct
		}
	}
	if v := q.Get("tag"); v != "" {
		filter.TagID = &v
	}
	if v := q.Get("created_after"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			filter.CreatedAfter = &t
		} else if t, err := time.Parse("2006-01-02", v); err == nil {
			filter.CreatedAfter = &t
		}
	}
	if v := q.Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			filter.Limit = n
		}
	}
	if v := q.Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			filter.Offset = n
		}
	}

	list, err := h.contacts.List(c.Request().Context(), filter)
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal memuat kontak")
	}
	return utils.OK(c, map[string]any{"contacts": list})
}

// Create handles POST /workspaces/:id/contacts.
func (h *ContactHandler) Create(c echo.Context) error {
	var req createContactRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	birthday, _ := parseBirthday(req.Birthday)

	contact, err := h.contacts.Create(c.Request().Context(), services.CreateContactInput{
		WorkspaceID: middleware.WorkspaceID(c),
		ActorID:     middleware.UserID(c),
		Name:        req.Name,
		Phone:       req.Phone,
		Email:       req.Email,
		Location:    req.Location,
		Company:     req.Company,
		Birthday:    birthday,
		Notes:       req.Notes,
		TagIDs:      req.TagIDs,
	})
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal membuat kontak")
	}
	return utils.Created(c, contact)
}

// Get handles GET /contacts/:id.
func (h *ContactHandler) Get(c echo.Context) error {
	detail, err := h.contacts.Get(c.Request().Context(), middleware.ContactID(c))
	if err != nil {
		if errors.Is(err, services.ErrContactNotFound) {
			return utils.Error(c, http.StatusNotFound, "not_found", "Kontak tidak ditemukan")
		}
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat kontak")
	}
	return utils.OK(c, detail)
}

// Update handles PATCH /contacts/:id.
func (h *ContactHandler) Update(c echo.Context) error {
	var req updateContactRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	birthday, _ := parseBirthday(req.Birthday)

	contact, err := h.contacts.Update(c.Request().Context(), services.UpdateContactInput{
		ID:       middleware.ContactID(c),
		Name:     req.Name,
		Phone:    req.Phone,
		Email:    req.Email,
		Location: req.Location,
		Company:  req.Company,
		Birthday: birthday,
		Notes:    req.Notes,
	})
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memperbarui kontak")
	}
	return utils.OK(c, contact)
}

// Delete handles DELETE /contacts/:id.
func (h *ContactHandler) Delete(c echo.Context) error {
	if err := h.contacts.Delete(c.Request().Context(), middleware.ContactID(c)); err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal menghapus kontak")
	}
	return c.NoContent(http.StatusNoContent)
}

// AttachTag handles POST /contacts/:id/tags.
func (h *ContactHandler) AttachTag(c echo.Context) error {
	var req attachTagRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	if err := h.contacts.AttachTag(c.Request().Context(), middleware.ContactID(c), req.TagID); err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal melampirkan tag")
	}
	return c.NoContent(http.StatusNoContent)
}

// DetachTag handles DELETE /contacts/:id/tags/:tagId.
func (h *ContactHandler) DetachTag(c echo.Context) error {
	tagID := c.Param("tagId")
	if err := h.contacts.DetachTag(c.Request().Context(), middleware.ContactID(c), tagID); err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal melepas tag")
	}
	return c.NoContent(http.StatusNoContent)
}

// Merge handles POST /contacts/:id/merge.
func (h *ContactHandler) Merge(c echo.Context) error {
	var req mergeContactRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	contact, err := h.contacts.Merge(c.Request().Context(),
		middleware.WorkspaceID(c), middleware.ContactID(c),
		req.TargetID, middleware.UserID(c))
	if err != nil {
		switch {
		case errors.Is(err, services.ErrSameContact):
			return utils.Error(c, http.StatusUnprocessableEntity,
				"invalid", "Kontak sumber dan tujuan sama")
		case errors.Is(err, services.ErrContactNotFound):
			return utils.Error(c, http.StatusNotFound,
				"not_found", "Salah satu kontak tidak ditemukan")
		default:
			return utils.Error(c, http.StatusInternalServerError,
				"internal_error", "Gagal menggabungkan kontak")
		}
	}
	return utils.OK(c, contact)
}

// Duplicates handles GET /workspaces/:id/contacts/duplicates.
func (h *ContactHandler) Duplicates(c echo.Context) error {
	list, err := h.contacts.FindDuplicates(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat duplikat")
	}
	return utils.OK(c, map[string]any{"contacts": list})
}

// Export handles GET /workspaces/:id/contacts/export.
func (h *ContactHandler) Export(c echo.Context) error {
	c.Response().Header().Set(echo.HeaderContentType, "text/csv; charset=utf-8")
	c.Response().Header().Set("Content-Disposition",
		`attachment; filename="contacts-`+time.Now().Format("20060102")+`.csv"`)
	c.Response().WriteHeader(http.StatusOK)
	if err := h.contacts.Export(c.Request().Context(),
		middleware.WorkspaceID(c), c.Response()); err != nil {
		// Best-effort: response already started.
		return err
	}
	return nil
}

// Import handles POST /workspaces/:id/contacts/import (multipart/form-data).
func (h *ContactHandler) Import(c echo.Context) error {
	fh, err := c.FormFile("file")
	if err != nil {
		return utils.Error(c, http.StatusBadRequest, "bad_request", "Field 'file' wajib")
	}
	if !strings.HasSuffix(strings.ToLower(fh.Filename), ".csv") &&
		!strings.Contains(fh.Header.Get("Content-Type"), "csv") {
		return utils.Error(c, http.StatusUnprocessableEntity,
			"invalid_file", "File harus berformat CSV")
	}
	if fh.Size > 5*1024*1024 {
		return utils.Error(c, http.StatusRequestEntityTooLarge,
			"too_large", "Maksimal 5MB")
	}
	src, err := fh.Open()
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal membuka file")
	}
	defer src.Close()

	data, err := io.ReadAll(src)
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal membaca file")
	}

	result, err := h.contacts.Import(c.Request().Context(),
		middleware.WorkspaceID(c), middleware.UserID(c), data)
	if err != nil {
		return utils.Error(c, http.StatusUnprocessableEntity,
			"import_failed", err.Error())
	}
	return utils.OK(c, result)
}

func parseBirthday(p *string) (*time.Time, bool) {
	if p == nil {
		return nil, true
	}
	s := strings.TrimSpace(*p)
	if s == "" {
		return nil, true
	}
	for _, layout := range []string{"2006-01-02", time.RFC3339, "02/01/2006"} {
		if t, err := time.Parse(layout, s); err == nil {
			return &t, true
		}
	}
	return nil, false
}
