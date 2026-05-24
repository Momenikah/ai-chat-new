// Package midtrans is a PLACEHOLDER payment-gateway client.
//
// It mimics the shape of a real Midtrans Snap integration (create a
// transaction, get a redirect/snap token) without performing any network
// call or handling real money. Swap the body of CreateTransaction for the
// real Snap API call when going live; the rest of the billing flow already
// speaks this interface.
package midtrans

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"
)

// Charge is the input for a (placeholder) transaction.
type Charge struct {
	OrderID    string
	AmountIDR  int64
	CustomerID string
	ItemName   string
}

// Transaction is the (placeholder) result returned to the caller.
type Transaction struct {
	OrderID       string    `json:"order_id"`
	TransactionID string    `json:"transaction_id"`
	SnapToken     string    `json:"snap_token"`
	RedirectURL   string    `json:"redirect_url"`
	GrossAmount   int64     `json:"gross_amount"`
	Status        string    `json:"status"` // "settlement" in placeholder mode
	IsPlaceholder bool      `json:"is_placeholder"`
	CreatedAt     time.Time `json:"created_at"`
}

// Client is the placeholder Midtrans client.
type Client struct {
	serverKey string
	baseURL   string
	enabled   bool
}

// NewClient constructs a placeholder client. When serverKey is empty the
// client runs in placeholder mode (no real charges) — which is the only
// mode implemented here.
func NewClient(serverKey, baseURL string) *Client {
	if baseURL == "" {
		baseURL = "https://app.sandbox.midtrans.com/snap/v2/vtweb"
	}
	return &Client{serverKey: serverKey, baseURL: baseURL, enabled: serverKey != ""}
}

// CreateTransaction returns a fake settled transaction. In a real
// integration this would POST to Snap and return a pending transaction
// whose status is later confirmed via webhook.
func (c *Client) CreateTransaction(ch Charge) (*Transaction, error) {
	txID, err := randomRef("txn")
	if err != nil {
		return nil, err
	}
	token, err := randomRef("snap")
	if err != nil {
		return nil, err
	}
	return &Transaction{
		OrderID:       ch.OrderID,
		TransactionID: txID,
		SnapToken:     token,
		RedirectURL:   fmt.Sprintf("%s/%s", c.baseURL, token),
		GrossAmount:   ch.AmountIDR,
		Status:        "settlement", // placeholder: treat as paid immediately
		IsPlaceholder: true,
		CreatedAt:     time.Now().UTC(),
	}, nil
}

func randomRef(prefix string) (string, error) {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return prefix + "_" + hex.EncodeToString(b), nil
}
