package apikey

import (
	"strings"
	"testing"
)

func TestGenerateProducesParsableUniqueKeys(t *testing.T) {
	a, err := Generate()
	if err != nil {
		t.Fatal(err)
	}
	b, _ := Generate()
	if a.Plaintext == b.Plaintext || a.Hash == b.Hash {
		t.Fatal("two generated keys collided")
	}
	if !strings.HasPrefix(a.Plaintext, Prefix) || len(a.Prefix) != PrefixDisplay {
		t.Fatalf("unexpected key shape: %q prefix=%q", a.Plaintext, a.Prefix)
	}
	if a.Hash != Hash(a.Plaintext) {
		t.Fatal("stored hash does not match Hash(plaintext)")
	}
	got, err := Parse("Bearer " + a.Plaintext)
	if err != nil || got != a.Plaintext {
		t.Fatalf("Parse(Bearer key) = %q, %v", got, err)
	}
}

func TestParseRejectsMalformedInput(t *testing.T) {
	for _, in := range []string{"", "   ", "Bearer ", "xyz_notOurPrefix_abcdefghijklmnop", "aic_short", "Bearer eyJhbGciOi.jwt.token"} {
		if _, err := Parse(in); err == nil {
			t.Errorf("Parse(%q) succeeded, want error", in)
		}
	}
}
