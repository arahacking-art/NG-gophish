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

func renderBase(t *testing.T, modern bool) string {
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
		Modern:       modern,
	}
	var buf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&buf, "base", params); err != nil {
		t.Fatalf("executing base (Modern=%v): %v", modern, err)
	}
	return buf.String()
}

// TestBaseTemplateLegacy ensures unmigrated pages keep the Bootstrap 3 chrome.
func TestBaseTemplateLegacy(t *testing.T) {
	out := renderBase(t, false)
	for _, want := range []string{
		"/css/dist/gophish.css",  // legacy stylesheet bundle
		"/js/dist/vendor.min.js", // legacy jQuery/Bootstrap 3 bundle
		"navbar-inverse",         // Bootstrap 3 navbar
		"BODY_MARKER",            // page body is rendered
		"SCRIPTS_MARKER",         // page scripts block is rendered
	} {
		if !strings.Contains(out, want) {
			t.Errorf("legacy base is missing %q", want)
		}
	}
	if strings.Contains(out, "/dist/main.js") {
		t.Errorf("legacy base must not load the modern bundle")
	}
}

// TestBaseTemplateModern ensures migrated pages get the Bootstrap 5 chrome.
func TestBaseTemplateModern(t *testing.T) {
	out := renderBase(t, true)
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
			t.Errorf("modern base is missing %q", want)
		}
	}
	if strings.Contains(out, "/js/dist/vendor.min.js") {
		t.Errorf("modern base must not load the legacy jQuery bundle")
	}
}
