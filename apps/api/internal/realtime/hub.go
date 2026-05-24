package realtime

import (
	"context"
	"encoding/json"
	"log"
	"sync"
)

// Hub fans events out to clients grouped by workspace.
type Hub struct {
	mu    sync.RWMutex
	rooms map[string]map[*Client]struct{}

	register   chan *Client
	unregister chan *Client
	broadcast  chan workspaceMessage

	// onConnect / onDisconnect are invoked when a client joins/leaves.
	// They are intentionally narrow (string, string) so the realtime
	// package depends on nothing else.
	OnConnect    func(userID, workspaceID string)
	OnDisconnect func(userID, workspaceID string)
}

type workspaceMessage struct {
	workspaceID string
	payload     []byte
}

// NewHub constructs a Hub.
func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[string]map[*Client]struct{}),
		register:   make(chan *Client, 32),
		unregister: make(chan *Client, 32),
		broadcast:  make(chan workspaceMessage, 256),
	}
}

// Run blocks, dispatching register/unregister/broadcast events. Stop by
// cancelling the context.
func (h *Hub) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case c := <-h.register:
			h.mu.Lock()
			room, ok := h.rooms[c.workspaceID]
			if !ok {
				room = map[*Client]struct{}{}
				h.rooms[c.workspaceID] = room
			}
			room[c] = struct{}{}
			h.mu.Unlock()
			if h.OnConnect != nil {
				h.OnConnect(c.userID, c.workspaceID)
			}

		case c := <-h.unregister:
			h.mu.Lock()
			if room, ok := h.rooms[c.workspaceID]; ok {
				if _, ok := room[c]; ok {
					delete(room, c)
					close(c.send)
					if len(room) == 0 {
						delete(h.rooms, c.workspaceID)
					}
				}
			}
			h.mu.Unlock()
			if h.OnDisconnect != nil {
				h.OnDisconnect(c.userID, c.workspaceID)
			}

		case msg := <-h.broadcast:
			h.mu.RLock()
			room := h.rooms[msg.workspaceID]
			for c := range room {
				select {
				case c.send <- msg.payload:
				default:
					// Slow consumer: drop the client.
					go func(c *Client) { h.unregister <- c }(c)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Broadcast queues an event for delivery to all clients of a workspace.
func (h *Hub) Broadcast(workspaceID string, event Event) {
	event.WorkspaceID = workspaceID
	payload, err := json.Marshal(event)
	if err != nil {
		log.Printf("realtime: marshal event: %v", err)
		return
	}
	select {
	case h.broadcast <- workspaceMessage{workspaceID: workspaceID, payload: payload}:
	default:
		log.Printf("realtime: broadcast queue full, dropping event %s", event.Type)
	}
}

// PresenceList returns the user ids currently connected to a workspace.
func (h *Hub) PresenceList(workspaceID string) []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	room := h.rooms[workspaceID]
	seen := map[string]struct{}{}
	out := make([]string, 0, len(room))
	for c := range room {
		if _, ok := seen[c.userID]; ok {
			continue
		}
		seen[c.userID] = struct{}{}
		out = append(out, c.userID)
	}
	return out
}
