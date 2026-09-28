// Package broadcast contains the worker-side broadcast processor: the
// job envelope, a Meta-API sender (WhatsApp/Instagram/Messenger), DB
// status updates and a per-channel rate limiter.
package broadcast

import "encoding/json"

// Job is the payload the API pushes onto the broadcast Redis queue.
//
// Channel-kind discriminates the downstream HTTP send path:
//   - "whatsapp"  → POST /{phone_number_id}/messages, messaging_product=whatsapp
//   - "instagram" → POST /me/messages, messaging_product=instagram
//   - "messenger" → POST /me/messages (no messaging_product)
//   - "onesender" → POST {gateway_url}/api/v1/messages (unofficial WA)
//   - "starsender"→ POST StarSender V3 /api/send (unofficial WA)
type Job struct {
	QueueRowID       string `json:"queue_row_id"`
	RecipientID      string `json:"recipient_id"`
	CampaignID       string `json:"campaign_id"`
	WorkspaceID      string `json:"workspace_id"`
	ChannelID        string `json:"channel_id"`
	ChannelKind      string `json:"channel_kind"`
	AccessToken      string `json:"access_token"`
	PhoneNumberID    string `json:"phone_number_id,omitempty"`
	MessagingProduct string `json:"messaging_product,omitempty"`
	RecipientTo      string `json:"recipient_to"`
	GatewayURL       string `json:"gateway_url,omitempty"`
	Body             string `json:"body"`
	RatePerMinute    int    `json:"rate_per_minute"`
}

// Unmarshal parses a raw Redis frame into a Job.
func Unmarshal(raw []byte) (Job, error) {
	var j Job
	err := json.Unmarshal(raw, &j)
	return j, err
}

// Marshal serializes a Job (used by the requeue path).
func (j Job) Marshal() ([]byte, error) {
	return json.Marshal(j)
}
