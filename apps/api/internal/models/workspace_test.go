package models

import "testing"

func TestMemberRoleAtLeast(t *testing.T) {
	order := []MemberRole{RoleViewer, RoleAgent, RoleAdmin, RoleOwner}
	for i, r := range order {
		for j, min := range order {
			if got, want := r.AtLeast(min), i >= j; got != want {
				t.Errorf("%s.AtLeast(%s) = %v, want %v", r, min, got, want)
			}
		}
	}
	// Unknown roles must never satisfy any requirement.
	if MemberRole("SUPERUSER").AtLeast(RoleViewer) {
		t.Error("unknown role granted access")
	}
}

func TestChannelTypeClassification(t *testing.T) {
	for _, tc := range []struct {
		t                    ChannelType
		valid, whatsapp, gwy bool
	}{
		{ChannelWhatsApp, true, true, false},
		{ChannelOneSender, true, true, true},
		{ChannelStarSender, true, true, true},
		{ChannelInstagram, true, false, false},
		{ChannelMessenger, true, false, false},
		{"telegram", false, false, false},
	} {
		if tc.t.Valid() != tc.valid || tc.t.IsWhatsApp() != tc.whatsapp || tc.t.IsWAGateway() != tc.gwy {
			t.Errorf("%s: Valid=%v IsWhatsApp=%v IsWAGateway=%v", tc.t, tc.t.Valid(), tc.t.IsWhatsApp(), tc.t.IsWAGateway())
		}
	}
}
