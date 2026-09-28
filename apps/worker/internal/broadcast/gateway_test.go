package broadcast

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSendGateway(t *testing.T) {
	var gotPath, gotAuth string
	var gotBody map[string]any
	reply := `{"code":200,"messages":[{"id":"os-1"}]}`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath, gotAuth = r.URL.Path, r.Header.Get("Authorization")
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &gotBody)
		_, _ = io.WriteString(w, reply)
	}))
	defer srv.Close()
	s := NewSender("", "").WithGateway(srv.Client(), srv.URL+"/api/send")

	id, err := s.Send(context.Background(), Job{
		ChannelKind: "onesender", GatewayURL: srv.URL, AccessToken: "k",
		RecipientTo: "+62 812-000", Body: "Promo",
	})
	if err != nil || id != "os-1" {
		t.Fatalf("onesender Send = %q, %v", id, err)
	}
	if gotPath != "/api/v1/messages" || gotAuth != "Bearer k" || gotBody["to"] != "62812000" {
		t.Errorf("onesender request path=%q auth=%q body=%v", gotPath, gotAuth, gotBody)
	}

	reply = `{"success":true,"data":{"id":"ss-1"}}`
	id, err = s.Send(context.Background(), Job{
		ChannelKind: "starsender", AccessToken: "dev", RecipientTo: "0812000", Body: "Hi",
	})
	if err != nil || id != "ss-1" {
		t.Fatalf("starsender Send = %q, %v", id, err)
	}
	if gotPath != "/api/send" || gotAuth != "dev" || gotBody["messageType"] != "text" || gotBody["to"] != "62812000" {
		t.Errorf("starsender request path=%q auth=%q body=%v", gotPath, gotAuth, gotBody)
	}

	reply = `{"success":false,"message":"Device disconnected"}`
	if _, err := s.Send(context.Background(), Job{ChannelKind: "starsender", AccessToken: "dev", RecipientTo: "62812", Body: "x"}); err == nil {
		t.Fatal("success=false not reported as error")
	}
	if _, err := s.Send(context.Background(), Job{ChannelKind: "onesender", AccessToken: "k", RecipientTo: "62812", Body: "x"}); err == nil {
		t.Fatal("missing OneSender URL accepted")
	}
}
