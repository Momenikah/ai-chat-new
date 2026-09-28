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
