package ai

import (
	"strings"
	"unicode"
)

// Chunk is one piece of a knowledge document after splitting.
type Chunk struct {
	Position int
	Content  string
	Tokens   int
}

// ChunkText splits raw document text into ~maxChars chunks aligned on
// paragraph boundaries when possible. `maxChars` controls the soft limit
// (default 1000). The token count is a rough word-based estimate.
func ChunkText(text string, maxChars int) []Chunk {
	if maxChars <= 0 {
		maxChars = 1000
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}

	// Split on blank lines first (paragraph boundary).
	paragraphs := splitParagraphs(text)

	var (
		chunks   []Chunk
		buf      strings.Builder
		position int
	)
	flush := func() {
		s := strings.TrimSpace(buf.String())
		if s == "" {
			return
		}
		chunks = append(chunks, Chunk{
			Position: position,
			Content:  s,
			Tokens:   approxTokens(s),
		})
		position++
		buf.Reset()
	}

	for _, p := range paragraphs {
		if buf.Len()+len(p)+2 > maxChars && buf.Len() > 0 {
			flush()
		}
		if len(p) > maxChars {
			// Single oversize paragraph — break on sentence-ish boundaries.
			for _, sentence := range splitSentences(p, maxChars) {
				if buf.Len()+len(sentence)+1 > maxChars && buf.Len() > 0 {
					flush()
				}
				if buf.Len() > 0 {
					buf.WriteByte(' ')
				}
				buf.WriteString(sentence)
			}
			continue
		}
		if buf.Len() > 0 {
			buf.WriteString("\n\n")
		}
		buf.WriteString(p)
	}
	flush()
	return chunks
}

func splitParagraphs(text string) []string {
	parts := strings.Split(text, "\n\n")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

// splitSentences greedily groups characters into chunks <= maxChars,
// breaking at sentence terminators when possible.
func splitSentences(p string, maxChars int) []string {
	var out []string
	var buf strings.Builder
	for i, r := range p {
		buf.WriteRune(r)
		isTerminal := r == '.' || r == '!' || r == '?' || r == '\n'
		if buf.Len() >= maxChars || (isTerminal && buf.Len() > maxChars/2) {
			out = append(out, strings.TrimSpace(buf.String()))
			buf.Reset()
		}
		_ = i
	}
	if buf.Len() > 0 {
		out = append(out, strings.TrimSpace(buf.String()))
	}
	return out
}

// approxTokens returns a quick token estimate (one per "word" + extras
// for punctuation density). Good enough for budgeting.
func approxTokens(s string) int {
	if s == "" {
		return 0
	}
	count := 0
	inWord := false
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			if !inWord {
				count++
				inWord = true
			}
		} else {
			inWord = false
		}
	}
	return count
}
