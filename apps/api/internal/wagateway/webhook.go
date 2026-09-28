package wagateway

import (
	"encoding/json"
	"strconv"
	"strings"
)

// Inbound is one normalized incoming message from a gateway webhook.
type Inbound struct {
	ID        string // provider message id (may be empty)
	From      string // sender phone, bare international digits
	PushName  string // sender's WhatsApp display name
	Text      string // text body or media caption
	MediaURL  string // publicly fetchable media URL, if any
	MediaType string // image | video | audio | document | sticker | …
	IsGroup   bool
	FromMe    bool // sent by the connected device itself
}

// Ignorable reports whether the event should not become an inbox
// message: group chats (the inbox is 1:1), messages sent by the device
// itself, and events with no sender or content (e.g. status pings).
func (in Inbound) Ignorable() bool {
	return in.IsGroup || in.FromMe || in.From == "" || (in.Text == "" && in.MediaURL == "")
}

// ParseWebhook extracts incoming messages from a gateway callback body.
// It accepts a single event object, an array of events, or an envelope
// with the event(s) under "data"/"message"/"messages".
func ParseWebhook(raw []byte) ([]Inbound, error) {
	var root any
	if err := json.Unmarshal(raw, &root); err != nil {
		return nil, err
	}
	var events []map[string]any
	collect(root, &events, 0)

	out := make([]Inbound, 0, len(events))
	for _, ev := range events {
		out = append(out, parseEvent(ev))
	}
	return out, nil
}

// collect flattens the supported envelope shapes into event objects.
func collect(v any, out *[]map[string]any, depth int) {
	if depth > 3 {
		return
	}
	switch node := v.(type) {
	case []any:
		for _, item := range node {
			collect(item, out, depth+1)
		}
	case map[string]any:
		if looksLikeEvent(node) {
			*out = append(*out, node)
			return
		}
		for _, key := range []string{"data", "messages", "message", "payload"} {
			if child, ok := node[key]; ok {
				switch child.(type) {
				case map[string]any, []any:
					collect(child, out, depth+1)
				}
			}
		}
	}
}

func looksLikeEvent(m map[string]any) bool {
	return firstString(m, senderPaths...) != ""
}

// senderPaths are checked only on the event object itself; envelopes such
// as {"event":"message","data":{…}} are unwrapped by collect first.
var senderPaths = []string{
	"from", "sender", "sender_phone", "senderPhone", "phone", "number",
	"remoteJid", "remote_jid", "key.remoteJid", "chat", "chat_id", "chatId",
}

func parseEvent(m map[string]any) Inbound {
	rawFrom := firstString(m, senderPaths...)
	in := Inbound{
		ID: firstString(m, "id", "message_id", "messageId", "msg_id", "key.id",
			"data.id", "data.message_id"),
		From: NormalizePhone(rawFrom),
		PushName: firstString(m, "push_name", "pushname", "pushName", "sender_name",
			"senderName", "notifyName", "name", "data.pushname", "data.push_name"),
		Text: firstString(m, "message_text", "text", "message", "body", "caption",
			"content", "text.body", "message.text", "message.conversation",
			"data.message", "data.body", "data.text"),
		MediaURL: firstString(m, "media_url", "mediaUrl", "file", "file_url",
			"url", "attachment", "image.link", "document.link", "data.file",
			"data.media_url"),
		MediaType: strings.ToLower(firstString(m, "message_type", "messageType",
			"type", "media_type", "data.type")),
		FromMe: firstBool(m, "from_me", "fromMe", "is_from_me", "isFromMe",
			"is_me", "isMe", "key.fromMe"),
		IsGroup: firstBool(m, "is_group", "isGroup", "data.is_group") ||
			strings.EqualFold(firstString(m, "chat_type", "chatType"), "group") ||
			strings.HasSuffix(rawFrom, "@g.us") ||
			strings.HasSuffix(firstString(m, "chat", "chat_id", "chatId"), "@g.us"),
	}
	// Some gateways put the text in "message" as an object; firstString
	// only returns strings, so nothing to undo here. A media message with
	// no explicit type is most likely an image.
	if in.MediaURL != "" && (in.MediaType == "" || in.MediaType == "text" || in.MediaType == "media") {
		in.MediaType = "image"
	}
	return in
}

/* ------------------------------ JSON paths ------------------------------ */

// lookup walks a dotted path ("a.b.0.c") through decoded JSON.
func lookup(v any, path string) (any, bool) {
	cur := v
	for _, seg := range strings.Split(path, ".") {
		switch node := cur.(type) {
		case map[string]any:
			next, ok := node[seg]
			if !ok {
				return nil, false
			}
			cur = next
		case []any:
			idx, err := strconv.Atoi(seg)
			if err != nil || idx < 0 || idx >= len(node) {
				return nil, false
			}
			cur = node[idx]
		default:
			return nil, false
		}
	}
	return cur, true
}

// firstString returns the first non-empty string (or number rendered as
// a string) found at any of the paths.
func firstString(v any, paths ...string) string {
	for _, p := range paths {
		val, ok := lookup(v, p)
		if !ok {
			continue
		}
		switch t := val.(type) {
		case string:
			if s := strings.TrimSpace(t); s != "" {
				return s
			}
		case float64:
			return strconv.FormatFloat(t, 'f', -1, 64)
		}
	}
	return ""
}

// firstBool returns the first boolean-ish value found at any of the paths.
func firstBool(v any, paths ...string) bool {
	for _, p := range paths {
		val, ok := lookup(v, p)
		if !ok {
			continue
		}
		switch t := val.(type) {
		case bool:
			return t
		case float64:
			return t != 0
		case string:
			switch strings.ToLower(strings.TrimSpace(t)) {
			case "1", "true", "yes":
				return true
			case "0", "false", "no", "":
				return false
			}
		}
	}
	return false
}
