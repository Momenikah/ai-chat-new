package realtime

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 8 * 1024
)

// Upgrader is the gorilla WebSocket upgrader. The handler is expected to
// have already authenticated and authorized the request, so we accept any
// origin from the API CORS perspective and rely on the JWT for security.
var Upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

// Client is a single WebSocket connection bound to a (user, workspace).
type Client struct {
	hub         *Hub
	conn        *websocket.Conn
	userID      string
	workspaceID string
	send        chan []byte
}

// NewClient registers and starts the read/write pumps for a connection.
// It is non-blocking; the pumps run in their own goroutines until the
// connection is closed.
func NewClient(hub *Hub, conn *websocket.Conn, userID, workspaceID string) *Client {
	c := &Client{
		hub:         hub,
		conn:        conn,
		userID:      userID,
		workspaceID: workspaceID,
		send:        make(chan []byte, 64),
	}
	hub.register <- c
	go c.writePump()
	go c.readPump()
	return c
}

// readPump receives client→server frames. It supports a single inbound
// event today: `{ "type": "typing", "conversation_id": "..." }`.
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("ws: read error: %v", err)
			}
			return
		}
		c.handleInbound(raw)
	}
}

// writePump pushes server→client frames and emits keep-alive pings.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleInbound interprets a client-sent JSON frame. Unknown frames are
// ignored to keep the protocol forward-compatible.
func (c *Client) handleInbound(raw []byte) {
	var env struct {
		Type           string `json:"type"`
		ConversationID string `json:"conversation_id"`
	}
	if err := json.Unmarshal(raw, &env); err != nil {
		return
	}
	switch env.Type {
	case EventTyping:
		c.hub.Broadcast(c.workspaceID, Event{
			Type: EventTyping,
			Payload: map[string]string{
				"user_id":         c.userID,
				"conversation_id": env.ConversationID,
			},
		})
	}
}
