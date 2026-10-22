package controllers

import (
	"bytes"
	"html/template"
	"strings"
	"testing"

	"github.com/gophish/gophish/models"
)

// dummyPageTemplates provides the "body" and "scripts" blocks that every page
// template normally supplies, so base.html can be executed in isolation.
const dummyPageTemplates = `{{define "body"}}<div id="BODY_MARKER">content</div>{{end}}` +
	`{{define "scripts"}}<div data-m="SCRIPTS_MARKER"></div>{{end}}`

func renderBase(t *testing.T) string {
	t.Helper()
	tmpl := template.New("t")
	_, err := tmpl.ParseFiles(
		"../templates/base.html",
		"../templates/nav.html",
		"../templates/flashes.html",
	)
	if err != nil {
		t.Fatalf("parsing templates: %v", err)
	}
	template.Must(tmpl.Parse(dummyPageTemplates))

	params := templateParams{
		Title:        "Test",
		Token:        "test-token",
		User:         models.User{Username: "admin", ApiKey: "test-key"},
		ModifySystem: true,
	}
	var buf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&buf, "base", params); err != nil {
		t.Fatalf("executing base: %v", err)
	}
	return buf.String()
}

// TestBaseTemplate ensures the shared layout renders the Bootstrap 5 chrome and
// the page's body/scripts, and no longer references the legacy jQuery bundle.
func TestBaseTemplate(t *testing.T) {
	out := renderBase(t)
	for _, want := range []string{
		"/dist/main.css",       // modern stylesheet
		"/dist/main.js",        // modern ES module bundle
		"ng-navbar",            // Bootstrap 5 navbar
		"ng-sidebar",           // Bootstrap 5 sidebar
		"ng-nav",               // modern nav block
		"data-ng-theme-toggle", // dark-mode toggle
		"BODY_MARKER",          // page body is rendered
		"SCRIPTS_MARKER",       // page scripts block is rendered
	} {
		if !strings.Contains(out, want) {
			t.Errorf("base template is missing %q", want)
		}
	}
	for _, legacy := range []string{"/js/dist/vendor.min.js", "navbar-inverse", "/css/dist/gophish.css"} {
		if strings.Contains(out, legacy) {
			t.Errorf("base template still references legacy asset %q", legacy)
		}
	}
}
