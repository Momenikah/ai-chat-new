package handlers

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// Maximum size accepted for a knowledge upload (defensive — protects the
// embed pipeline from runaway documents).
const maxKnowledgeUploadBytes = int64(5 * 1024 * 1024)

// KnowledgeHandler exposes the workspace knowledge-base endpoints
// (list / create / upload / search / delete).
type KnowledgeHandler struct {
	knowledge *services.KnowledgeService
	agents    *services.AIAgentService
}

// NewKnowledgeHandler constructs a KnowledgeHandler.
func NewKnowledgeHandler(k *services.KnowledgeService, a *services.AIAgentService) *KnowledgeHandler {
	return &KnowledgeHandler{knowledge: k, agents: a}
}

type createKnowledgeRequest struct {
	Title      string  `json:"title" validate:"required,min=1,max=200"`
	SourceKind string  `json:"source_kind" validate:"required,oneof=manual url"`
	SourceURL  *string `json:"source_url" validate:"omitempty,url,max=500"`
	Content    string  `json:"content" validate:"required,max=200000"`
}

// List handles GET /workspaces/:id/knowledge.
func (h *KnowledgeHandler) List(c echo.Context) error {
	list, err := h.knowledge.List(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat knowledge base")
	}
	return utils.OK(c, map[string]any{"documents": list})
}

// Create handles POST /workspaces/:id/knowledge (JSON: manual article or
// URL placeholder where `content` holds the scraped text).
func (h *KnowledgeHandler) Create(c echo.Context) error {
	var req createKnowledgeRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	embedModel, err := h.embeddingModel(c)
	if err != nil {
		return err
	}
	doc, err := h.knowledge.Ingest(c.Request().Context(), services.IngestInput{
		WorkspaceID:    middleware.WorkspaceID(c),
		ActorID:        middleware.UserID(c),
		Title:          req.Title,
		SourceKind:     models.KnowledgeSource(req.SourceKind),
		SourceURL:      req.SourceURL,
		RawContent:     req.Content,
		EmbeddingModel: embedModel,
	})
	if err != nil {
		return mapKnowledgeError(c, err)
	}
	return utils.Created(c, doc)
}

// Upload handles POST /workspaces/:id/knowledge/upload (multipart/form-data
// with field `file`; .txt and .md supported natively, .pdf accepted only as
// pre-extracted plain text for now).
func (h *KnowledgeHandler) Upload(c echo.Context) error {
	fh, err := c.FormFile("file")
	if err != nil {
		return utils.Error(c, http.StatusBadRequest, "bad_request", "Field 'file' wajib")
	}
	if fh.Size > maxKnowledgeUploadBytes {
		return utils.Error(c, http.StatusRequestEntityTooLarge,
			"too_large", "Maksimal "+strconv.FormatInt(maxKnowledgeUploadBytes/1024/1024, 10)+"MB")
	}
	lowerName := strings.ToLower(fh.Filename)
	mime := fh.Header.Get("Content-Type")
	if !knowledgeFileAllowed(lowerName, mime) {
		return utils.Error(c, http.StatusUnprocessableEntity,
			"invalid_file", "Format harus .txt, .md, atau .pdf")
	}

	src, err := fh.Open()
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal membuka file")
	}
	defer src.Close()
	buf, err := io.ReadAll(io.LimitReader(src, maxKnowledgeUploadBytes+1))
	if err != nil || int64(len(buf)) > maxKnowledgeUploadBytes {
		return utils.Error(c, http.StatusRequestEntityTooLarge,
			"too_large", "Maksimal "+strconv.FormatInt(maxKnowledgeUploadBytes/1024/1024, 10)+"MB")
	}

	title := c.FormValue("title")
	if title == "" {
		title = fh.Filename
	}
	embedModel, err := h.embeddingModel(c)
	if err != nil {
		return err
	}
	mt := mime
	doc, err := h.knowledge.Ingest(c.Request().Context(), services.IngestInput{
		WorkspaceID:    middleware.WorkspaceID(c),
		ActorID:        middleware.UserID(c),
		Title:          title,
		SourceKind:     models.KnowledgeSourceUpload,
		MimeType:       &mt,
		RawContent:     string(buf),
		EmbeddingModel: embedModel,
	})
	if err != nil {
		return mapKnowledgeError(c, err)
	}
	return utils.Created(c, doc)
}

// Delete handles DELETE /workspaces/:id/knowledge/:docId.
func (h *KnowledgeHandler) Delete(c echo.Context) error {
	id := c.Param("docId")
	doc, err := h.knowledge.Get(c.Request().Context(), id)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return utils.Error(c, http.StatusNotFound, "not_found", "Dokumen tidak ditemukan")
		}
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat dokumen")
	}
	if doc.WorkspaceID != middleware.WorkspaceID(c) {
		return utils.Error(c, http.StatusNotFound, "not_found", "Dokumen tidak ditemukan")
	}
	if err := h.knowledge.Delete(c.Request().Context(), id); err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal menghapus dokumen")
	}
	return c.NoContent(http.StatusNoContent)
}

// Search handles GET /workspaces/:id/knowledge/search?q=...&limit=N.
// Useful for the knowledge debugger panel; not used in the auto-reply path.
func (h *KnowledgeHandler) Search(c echo.Context) error {
	q := strings.TrimSpace(c.QueryParam("q"))
	if q == "" {
		return utils.OK(c, map[string]any{"results": []any{}})
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	embedModel, err := h.embeddingModel(c)
	if err != nil {
		return err
	}
	results, err := h.knowledge.Search(c.Request().Context(),
		middleware.WorkspaceID(c), embedModel, q, limit)
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal mencari knowledge")
	}
	return utils.OK(c, map[string]any{"results": results})
}

func (h *KnowledgeHandler) embeddingModel(c echo.Context) (string, error) {
	agent, err := h.agents.Get(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return "", utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat agent")
	}
	return agent.EmbeddingModel, nil
}

func knowledgeFileAllowed(filename, mime string) bool {
	switch {
	case strings.HasSuffix(filename, ".txt"),
		strings.HasSuffix(filename, ".md"),
		strings.HasSuffix(filename, ".pdf"):
		return true
	}
	if strings.Contains(mime, "text/") ||
		strings.Contains(mime, "markdown") ||
		strings.Contains(mime, "pdf") {
		return true
	}
	return false
}

func mapKnowledgeError(c echo.Context, err error) error {
	if resp, handled := handlePlanError(c, err); handled {
		return resp
	}
	if errors.Is(err, services.ErrEmptyKnowledge) {
		return utils.Error(c, http.StatusUnprocessableEntity, "empty", "Dokumen kosong")
	}
	return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memproses dokumen")
}
