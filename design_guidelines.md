{
  "project": {
    "name": "Blue Diamond Voyage — Travel OS (BDV)",
    "aesthetic": "FUI / command-center (sci-fi-inspired) for travel consultants",
    "primary_font": "Figtree (already implemented; keep as sole font)",
    "modes": {
      "dark": "Refined FUI: deep navy canvas + cyan interactive glow",
      "light": "Steel-ink command center: cool mist canvas + navy interactive (no generic white app)"
    }
  },

  "brand_attributes": {
    "keywords": [
      "mission-control",
      "premium",
      "calm focus",
      "high-legibility",
      "data-dense",
      "low-fatigue",
      "trustworthy",
      "precise"
    ],
    "do": [
      "Use cyan only as the signature interactive accent in DARK mode.",
      "Use BDV Navy (#2E4374) as the primary interactive color in LIGHT mode.",
      "Keep surfaces solid (no gradients on general surfaces).",
      "Prefer subtle grid/scanline textures at very low opacity for FUI feel.",
      "Keep chroma restrained; reserve strongest saturation for primary actions + active states."
    ],
    "avoid": [
      "Over-glowy neon everywhere (fatiguing for 6+ hour use).",
      "Pure white backgrounds without depth (feels generic).",
      "High-saturation greens (no neon success).",
      "Purple in AI/chat areas (explicitly prohibited by global rules)."
    ]
  },

  "design_tokens": {
    "notes": [
      "CRITICAL: ALL color changes MUST be expressed as CSS variable updates to :root (dark default), html.dark (deep dark variant), html.light (light mode).",
      "Provide complete replacement blocks below. These include BOTH legacy BDV variables (e.g., --app-bg, --cta) AND shadcn HSL tokens (--background, --primary, etc.).",
      "Hex values are provided for every legacy variable. Shadcn tokens remain HSL as required by the library."
    ],

    "css_variable_blocks_COMPLETE_REPLACEMENTS": {
      ":root": "/* ════════════════════════════════════════════════════════════════════════════\n   DESIGN TOKENS — Dark Mode (Default / Refined FUI Dark Canvas)\n   COMPLETE REPLACEMENT BLOCK\n   ════════════════════════════════════════════════════════════════════════════ */\n:root {\n  /* ── Core Canvas ─────────────────────────────────────────────── */\n  --j-base:     #050A14;\n  --j-surface:  #0A1220;\n  --j-panel:    rgba(14,26,43,0.72);\n  --j-elevated: #0E1A2B;\n\n  /* ── Signature Glow Accents (dark mode keeps cyan) ───────────── */\n  --j-cyan:   #00E5FF;\n  --j-blue:   #1B9CFC;\n  --j-blue2:  #4FC3F7;\n  --j-teal:   #00D6C2;\n  --j-amber:  #FFB300;\n  --j-red:    #C0392B;\n  --j-green:  #2F9E6F;\n\n  /* ── Text ────────────────────────────────────────────────────── */\n  --j-text:     #E6F7FF;\n  --j-text2:    #8FB3C7;\n  --j-text-dim: #4A6070;\n\n  /* ── Mapped legacy names (keeps every component working) ─────── */\n  --app-bg:          #050A14;\n  --surface:         #0A1220;\n  --surface-2:       #0E1A2B;\n  --surface-3:       #122031;\n\n  /* Strokes tuned to be calmer (less neon) but still FUI */\n  --stroke:          rgba(0,229,255,0.20);\n  --stroke-soft:     rgba(0,229,255,0.10);\n\n  --app-fg:          #E6F7FF;\n  --app-muted:       #8FB3C7;\n  --app-dim:         rgba(230,247,255,0.58);\n\n  /* CTA stays cyan in dark mode */\n  --cta:             #00E5FF;\n  --cta-hover:       #4FC3F7;\n  --cta-pressed:     #1B9CFC;\n\n  /* Brand-required warm red + non-neon green */\n  --danger:          #C0392B;\n  --danger-bg:       rgba(192,57,43,0.12);\n  --success:         #2F9E6F;\n  --success-bg:      rgba(47,158,111,0.12);\n  --info:            #4FC3F7;\n\n  /* ── Elevation / Glow (refined: less bloom, more depth) ───────── */\n  --shadow-1:        0 10px 30px rgba(0,0,0,0.55);\n  --shadow-2:        0 18px 54px rgba(0,0,0,0.72);\n  --glow-cyan:       0 0 10px rgba(0,229,255,0.28), inset 0 0 8px rgba(0,229,255,0.06);\n  --glow-cyan-sm:    0 0 6px rgba(0,229,255,0.22);\n  --inner-glow:      inset 0 0 10px rgba(0,229,255,0.05);\n\n  /* ── Geometry ────────────────────────────────────────────────── */\n  --r-card:   10px;\n  --r-modal:  12px;\n  --r-input:  6px;\n  --r-pill:   999px;\n  --radius:   0.6rem;\n\n  /* ── Focus ring ─────────────────────────────────────────────── */\n  --ring: 0 0 0 2px rgba(0,229,255,0.38);\n\n  /* ── Sidebar ─────────────────────────────────────────────────── */\n  --sidebar-bg:        #06101E;\n  --sidebar-text:      #E6F7FF;\n  --sidebar-muted:     #8FB3C7;\n  --sidebar-border:    rgba(0,229,255,0.16);\n  --sidebar-hover-bg:  rgba(0,229,255,0.06);\n  --border:            rgba(0,229,255,0.16);\n\n  /* ── Brand compat ────────────────────────────────────────────── */\n  --brand-primary:      #050A14;\n  --brand-accent:       #00E5FF;\n  --brand-accent-light: #4FC3F7;\n  --brand-ring:         rgba(0,229,255,0.32);\n\n  /* ── Quote Builder tokens ────────────────────────────────────── */\n  --qb-modal:               #07111F;\n  --qb-modal-2:             #0B192A;\n  --qb-field:               #050D18;\n  --qb-field-border:        rgba(0,229,255,0.16);\n  --qb-field-border-hover:  rgba(0,229,255,0.34);\n  --qb-field-border-focus:  rgba(0,229,255,0.62);\n  --qb-divider:             rgba(0,229,255,0.10);\n  --qb-shadow:              0 20px 64px rgba(0,0,0,0.74);\n\n  /* ── Tab accent colors (keep functional mapping) ─────────────── */\n  --tab-flights: #1B9CFC;\n  --tab-hotels:  #2F9E6F;\n  --tab-tours:   #FFB300;\n  --tab-visa:    #00E5FF;\n  --tab-markup:  #FFB300;\n}\n",

      "html.dark": "/* ── Deep Dark variant (more contrast, same identity) ─────────────── */\nhtml.dark {\n  --app-bg:          #030810;\n  --surface:         #060F1C;\n  --surface-2:       #0B1628;\n  --surface-3:       #0F1D34;\n\n  --stroke:          rgba(0,229,255,0.22);\n  --stroke-soft:     rgba(0,229,255,0.12);\n\n  --shadow-1:        0 10px 34px rgba(0,0,0,0.68);\n  --shadow-2:        0 20px 60px rgba(0,0,0,0.82);\n\n  --sidebar-bg:      #040C18;\n  --sidebar-border:  rgba(0,229,255,0.18);\n  --border:          rgba(0,229,255,0.18);\n\n  --qb-modal:        #040C18;\n  --qb-modal-2:      #081422;\n  --qb-field:        #030A14;\n  --qb-field-border: rgba(0,229,255,0.18);\n\n  --brand-primary:   #030810;\n}\n",

      "html.light": "/* ════════════════════════════════════════════════════════════════════════════\n   Light Mode (Steel-Ink Command Center)\n   COMPLETE REPLACEMENT BLOCK\n   - Navy (#2E4374) becomes primary interactive color\n   - Cyan becomes a supporting info/telemetry accent (not primary)\n   ════════════════════════════════════════════════════════════════════════════ */\nhtml.light {\n  /* Canvas (avoid pure white; keep cool mist) */\n  --j-base:     #EEF3FA;\n  --j-surface:  #F9FBFE;\n  --j-panel:    rgba(255,255,255,0.92);\n  --j-elevated: #F3F7FD;\n\n  /* Accents */\n  --j-cyan:   #0B7EA1;\n  --j-blue:   #2E4374;\n  --j-blue2:  #3E5A96;\n  --j-teal:   #0B7EA1;\n  --j-amber:  #B37800;\n  --j-red:    #C0392B;\n  --j-green:  #2F7D5B;\n\n  /* Text */\n  --j-text:     #0C1E35;\n  --j-text2:    #3F5674;\n  --j-text-dim: #7E93AE;\n\n  /* Legacy mapped */\n  --app-bg:          #EEF3FA;\n  --surface:         #F9FBFE;\n  --surface-2:       #F3F7FD;\n  --surface-3:       #E8F0FB;\n\n  /* Strokes use navy tint (not cyan) */\n  --stroke:          rgba(46,67,116,0.18);\n  --stroke-soft:     rgba(46,67,116,0.10);\n\n  --app-fg:          #0C1E35;\n  --app-muted:       #3F5674;\n  --app-dim:         rgba(12,30,53,0.62);\n\n  /* Primary interactive becomes Navy */\n  --cta:             #2E4374;\n  --cta-hover:       #3E5A96;\n  --cta-pressed:     #24365D;\n\n  --danger:          #C0392B;\n  --danger-bg:       rgba(192,57,43,0.10);\n  --success:         #2F7D5B;\n  --success-bg:      rgba(47,125,91,0.10);\n  --info:            #0B7EA1;\n\n  /* Shadows (premium, not flat) */\n  --shadow-1:        0 2px 14px rgba(16,34,64,0.10);\n  --shadow-2:        0 10px 28px rgba(16,34,64,0.14);\n\n  /* Light-mode glow is subtle and navy-led */\n  --glow-cyan:       0 0 8px rgba(46,67,116,0.16), inset 0 0 4px rgba(46,67,116,0.05);\n  --glow-cyan-sm:    0 0 4px rgba(46,67,116,0.14);\n  --inner-glow:      inset 0 0 8px rgba(46,67,116,0.04);\n\n  /* Focus ring */\n  --ring: 0 0 0 2px rgba(46,67,116,0.30);\n\n  /* Sidebar */\n  --sidebar-bg:        #F9FBFE;\n  --sidebar-text:      #0C1E35;\n  --sidebar-muted:     #3F5674;\n  --sidebar-border:    rgba(46,67,116,0.14);\n  --sidebar-hover-bg:  rgba(46,67,116,0.06);\n  --border:            rgba(46,67,116,0.16);\n\n  /* Brand */\n  --brand-primary:      #EEF3FA;\n  --brand-accent:       #2E4374;\n  --brand-accent-light: #3E5A96;\n  --brand-ring:         rgba(46,67,116,0.26);\n\n  /* Quote Builder */\n  --qb-modal:               #F9FBFE;\n  --qb-modal-2:             #F3F7FD;\n  --qb-field:               #FFFFFF;\n  --qb-field-border:        rgba(46,67,116,0.18);\n  --qb-field-border-hover:  rgba(46,67,116,0.32);\n  --qb-field-border-focus:  rgba(46,67,116,0.56);\n  --qb-divider:             rgba(46,67,116,0.10);\n  --qb-shadow:              0 16px 44px rgba(16,34,64,0.14);\n}\n"
    },

    "shadcn_hsl_tokens_COMPLETE_REPLACEMENTS": {
      "@layer base :root (dark default)": "@layer base {\n  :root {\n    --background:             220 67% 6%;\n    --foreground:             200 100% 95%;\n\n    --card:                   218 50% 9%;\n    --card-foreground:        200 100% 95%;\n\n    --popover:                215 50% 12%;\n    --popover-foreground:     200 100% 95%;\n\n    /* Primary = cyan in dark mode */\n    --primary:                187 100% 50%;\n    --primary-foreground:     220 67% 6%;\n\n    --secondary:              215 45% 13%;\n    --secondary-foreground:   200 100% 95%;\n\n    --muted:                  215 45% 13%;\n    --muted-foreground:       200 30% 67%;\n\n    --accent:                 215 45% 13%;\n    --accent-foreground:      187 100% 50%;\n\n    /* Warm red */\n    --destructive:            8 64% 46%;\n    --destructive-foreground: 200 100% 95%;\n\n    --border:                 215 38% 20%;\n    --input:                  215 38% 20%;\n    --ring:                   187 100% 50%;\n\n    --radius:                 0.6rem;\n\n    /* Charts */\n    --chart-1: 187 100% 50%;\n    --chart-2: 155  42% 40%;\n    --chart-3: 210  97% 55%;\n    --chart-4:   8  64% 46%;\n    --chart-5:  45 100% 50%;\n  }\n}\n",

      "@layer base .dark (deep dark variant)": "@layer base {\n  .dark {\n    --background:             222 72% 5%;\n    --foreground:             200 100% 95%;\n\n    --card:                   218 60% 7%;\n    --card-foreground:        200 100% 95%;\n\n    --popover:                215 55% 10%;\n    --popover-foreground:     200 100% 95%;\n\n    --primary:                187 100% 50%;\n    --primary-foreground:     222 72% 5%;\n\n    --secondary:              215 50% 11%;\n    --secondary-foreground:   200 100% 95%;\n\n    --muted:                  215 50% 11%;\n    --muted-foreground:       200 30% 67%;\n\n    --accent:                 215 50% 11%;\n    --accent-foreground:      187 100% 50%;\n\n    --destructive:            8 64% 46%;\n    --destructive-foreground: 200 100% 95%;\n\n    --border:                 215 40% 17%;\n    --input:                  215 40% 17%;\n    --ring:                   187 100% 50%;\n\n    --chart-1: 187 100% 50%;\n    --chart-2: 155  42% 40%;\n    --chart-3: 210  97% 55%;\n    --chart-4:   8  64% 46%;\n    --chart-5:  45 100% 50%;\n  }\n}\n",

      "@layer base .light (light mode)": "@layer base {\n  .light {\n    --background:             213 40% 95%;\n    --foreground:             213 62% 14%;\n\n    --card:                   210 33% 99%;\n    --card-foreground:        213 62% 14%;\n\n    --popover:                210 33% 99%;\n    --popover-foreground:     213 62% 14%;\n\n    /* Primary = BDV Navy in light mode */\n    --primary:                222 43% 32%;\n    --primary-foreground:     0 0% 100%;\n\n    --secondary:              213 35% 94%;\n    --secondary-foreground:   213 62% 14%;\n\n    --muted:                  213 35% 94%;\n    --muted-foreground:       213 28% 34%;\n\n    /* Accent = telemetry teal (supporting) */\n    --accent:                 193 87% 34%;\n    --accent-foreground:      0 0% 100%;\n\n    --destructive:            8 64% 46%;\n    --destructive-foreground: 0 0% 100%;\n\n    --border:                 222 25% 86%;\n    --input:                  222 25% 86%;\n    --ring:                   222 43% 32%;\n\n    --chart-1: 222 43% 32%;\n    --chart-2: 155  34% 34%;\n    --chart-3: 193 87% 34%;\n    --chart-4:   8  64% 46%;\n    --chart-5:  45 93% 47%;\n  }\n}\n"
    },

    "semantic_status_colors": {
      "draft": {
        "bg": {
          "dark": "rgba(143,179,199,0.10)",
          "light": "rgba(63,86,116,0.10)"
        },
        "fg": {
          "dark": "#8FB3C7",
          "light": "#3F5674"
        },
        "stroke": {
          "dark": "rgba(143,179,199,0.22)",
          "light": "rgba(63,86,116,0.22)"
        }
      },
      "sent": {
        "bg": {
          "dark": "rgba(27,156,252,0.12)",
          "light": "rgba(46,67,116,0.10)"
        },
        "fg": {
          "dark": "#4FC3F7",
          "light": "#2E4374"
        },
        "stroke": {
          "dark": "rgba(79,195,247,0.28)",
          "light": "rgba(46,67,116,0.22)"
        }
      },
      "confirmed": {
        "bg": {
          "dark": "rgba(47,158,111,0.14)",
          "light": "rgba(47,125,91,0.12)"
        },
        "fg": {
          "dark": "#2F9E6F",
          "light": "#2F7D5B"
        },
        "stroke": {
          "dark": "rgba(47,158,111,0.30)",
          "light": "rgba(47,125,91,0.26)"
        }
      },
      "lost": {
        "bg": {
          "dark": "rgba(192,57,43,0.14)",
          "light": "rgba(192,57,43,0.12)"
        },
        "fg": {
          "dark": "#C0392B",
          "light": "#C0392B"
        },
        "stroke": {
          "dark": "rgba(192,57,43,0.30)",
          "light": "rgba(192,57,43,0.26)"
        }
      }
    }
  },

  "typography": {
    "font_family": {
      "ui": "Figtree, sans-serif",
      "mono": "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace (already referenced in tables)"
    },
    "scale_tailwind": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl",
      "h2": "text-base md:text-lg",
      "body": "text-sm md:text-base",
      "small": "text-xs text-[11px] for table headers/telemetry labels"
    },
    "usage_rules": [
      "Keep uppercase + tracking only for navigation labels, table headers, and small telemetry chips.",
      "For long-form content (itinerary notes, CRM notes), use normal case, tracking-normal, leading-6.",
      "Numeric KPIs: use tabular-nums (Tailwind: tabular-nums) and optionally mono for IDs/PNRs."
    ]
  },

  "layout_and_grid": {
    "desktop_first": {
      "app_shell": "Left sidebar (72–84px collapsed / 240–280px expanded) + top command bar (48–56px) + main canvas.",
      "content_grid": "12-col grid on ≥1280px; primary panels span 8 cols, secondary panels 4 cols. Use 24px gaps.",
      "panel_density": "Use 2–3x more spacing than feels comfortable: 20–24px padding in cards, 12–16px in dense tables."
    },
    "mobile_first_rules": [
      "Stack panels; keep sidebar as Sheet/Drawer.",
      "Use ScrollArea for dense lists and tables.",
      "Keep primary CTA pinned (sticky footer bar) only on mobile flows like Login/PIN and Quote send."
    ]
  },

  "components": {
    "component_path": {
      "buttons": "/app/frontend/src/components/ui/button.jsx",
      "cards": "/app/frontend/src/components/ui/card.jsx",
      "tabs": "/app/frontend/src/components/ui/tabs.jsx",
      "dialog": "/app/frontend/src/components/ui/dialog.jsx",
      "drawer": "/app/frontend/src/components/ui/drawer.jsx",
      "sheet": "/app/frontend/src/components/ui/sheet.jsx",
      "table": "/app/frontend/src/components/ui/table.jsx",
      "badge": "/app/frontend/src/components/ui/badge.jsx",
      "select": "/app/frontend/src/components/ui/select.jsx",
      "dropdown": "/app/frontend/src/components/ui/dropdown-menu.jsx",
      "calendar": "/app/frontend/src/components/ui/calendar.jsx",
      "tooltip": "/app/frontend/src/components/ui/tooltip.jsx",
      "sonner_toast": "/app/frontend/src/components/ui/sonner.jsx",
      "scroll_area": "/app/frontend/src/components/ui/scroll-area.jsx",
      "resizable": "/app/frontend/src/components/ui/resizable.jsx",
      "command_palette": "/app/frontend/src/components/ui/command.jsx"
    },

    "bdv_fui_primitives_existing_css_classes": {
      "panels": ["hud-panel", "hud-panel-active", "hud-clip", "hud-clip-sm", "hud-grid", "hud-scanline"],
      "inputs": ["hud-input"],
      "buttons": ["hud-btn", "hud-btn-primary"],
      "tables": ["jarvis-table"],
      "cards": ["stat-card", "kanban-card", "boarding-pass"],
      "pin": ["pin-btn", "pin-dot"],
      "motion": ["animate-jarvis-enter", "animate-jarvis-glow", "animate-jarvis-ring", "animate-jarvis-fade", "animate-pulse-dot"]
    },

    "component_behavior_guidelines": {
      "buttons": {
        "primary": {
          "dark": "Cyan fill (var(--cta)) with dark text (#050A14).",
          "light": "Navy fill (var(--cta)) with white text.",
          "hover": "Increase glow slightly; do not increase saturation too much.",
          "active": "scale(0.98) press; keep transition only on background-color/box-shadow/opacity (already compliant).",
          "data_testid_examples": [
            "data-testid=\"dashboard-primary-cta-button\"",
            "data-testid=\"quote-builder-send-button\""
          ]
        },
        "secondary": {
          "style": "Transparent with 1px stroke var(--stroke); hover uses subtle tinted bg (rgba(...,0.06–0.10)).",
          "data_testid_examples": ["data-testid=\"crm-filter-button\""]
        },
        "ghost": {
          "style": "No border; hover uses --sidebar-hover-bg or surface-3 tint.",
          "data_testid_examples": ["data-testid=\"topbar-help-button\""]
        }
      },

      "inputs": {
        "style": "Use bottom-border HUD input for quick fields; use shadcn Input for forms/modals requiring clear boundaries.",
        "focus": "Use --ring and bottom glow; ensure focus-visible is obvious in both modes.",
        "data_testid_examples": [
          "data-testid=\"login-pin-input\"",
          "data-testid=\"crm-search-input\"",
          "data-testid=\"quote-builder-customer-name-input\""
        ]
      },

      "tables": {
        "row_height": "48px (already in .jarvis-table)",
        "hover": "Row hover adds subtle background + left accent bar (inset 3px 0 0 var(--cta)).",
        "density": "Use text-[13px] for dense tables; keep headers at 11px uppercase.",
        "data_testid_examples": ["data-testid=\"crm-leads-table\""]
      },

      "badges_status": {
        "use": "Use Badge component for Draft/Sent/Confirmed/Lost with semantic colors above.",
        "data_testid_examples": ["data-testid=\"lead-status-badge\""]
      },

      "dialogs_modals": {
        "quote_builder": "Use Dialog + Tabs inside; modal surfaces use --qb-modal and --qb-modal-2; fields use --qb-field.",
        "data_testid_examples": [
          "data-testid=\"quote-builder-dialog\"",
          "data-testid=\"quote-builder-tabs\""
        ]
      },

      "ai_chat_compass": {
        "rule": "No purple. In dark mode, keep cyan for send/active; in light mode, navy for send/active; use teal (#0B7EA1) for assistant highlights.",
        "empty_state": "Use Skeleton + subtle scanline overlay; show suggested prompts as Buttons (secondary).",
        "data_testid_examples": [
          "data-testid=\"compass-chat-input\"",
          "data-testid=\"compass-chat-send-button\"",
          "data-testid=\"compass-chat-thread\""
        ]
      }
    }
  },

  "motion_and_microinteractions": {
    "principles": [
      "Motion should feel like instrumentation: short, precise, low-amplitude.",
      "Prefer opacity + translateY(6–10px) entrances for panels.",
      "Use breathing glow only for active/armed states (selected panel, live sync, recording)."
    ],
    "recommended": {
      "panel_enter": "Use existing .animate-jarvis-enter on cards/panels when they mount.",
      "active_panel": "Use .hud-panel-active sparingly (only 1–2 panels visible at once).",
      "scan_sweep": "Optional: add a pseudo-element sweep on critical actions (Quote Sent) for 600–900ms; keep opacity < 0.12.",
      "hover": "Buttons/cards: shadow + slight translateY(-2px) (already used)."
    },
    "libraries": {
      "framer_motion": {
        "when": "If you need orchestrated page transitions (Dashboard → CRM → Quote Builder) and staggered list entrances.",
        "install": "npm i framer-motion",
        "usage_note": "Use motion.div for panel enter; keep durations 0.18–0.28s; avoid springy bounces."
      }
    }
  },

  "accessibility": {
    "rules": [
      "WCAG AA contrast: ensure muted text still passes on surfaces (especially light mode).",
      "Focus-visible must be obvious: use --ring and avoid removing outlines without replacement.",
      "Respect prefers-reduced-motion (already present in index.css).",
      "Clickable targets: minimum 40px height for primary actions; tables can be 48px rows."
    ],
    "testing": {
      "data_testid_requirement": "All interactive and key informational elements MUST include data-testid in kebab-case describing role (not appearance)."
    }
  },

  "image_urls": {
    "note": "This is an internal SaaS tool; avoid stock travel hero imagery. Prefer abstract telemetry textures if needed. Current UI already uses CSS grid/scanline textures; no external images required.",
    "categories": [
      {
        "category": "optional-background-texture",
        "description": "If you want a subtle noise overlay image (very low opacity) for light mode to avoid flatness.",
        "urls": []
      }
    ]
  },

  "instructions_to_main_agent": [
    "Replace the existing variable blocks in /app/frontend/src/index.css with the COMPLETE REPLACEMENT BLOCKS provided above (do not partially merge).",
    "Ensure theme switching sets html.light or html.dark class consistently; dark default remains :root.",
    "Audit any hard-coded blues in components; map them to var(--cta) / var(--stroke) / var(--app-fg) so both modes stay unified.",
    "For light mode, ensure interactive accents (active nav, primary buttons, focus rings) use Navy (#2E4374) via --cta and shadcn --primary.",
    "Keep cyan as signature interactive only in dark mode; in light mode cyan/teal is supporting info accent only.",
    "Implement status chips for Draft/Sent/Confirmed/Lost using the semantic_status_colors mapping.",
    "Add data-testid to: sidebar items, theme toggle, primary CTAs, search inputs, table containers, dialog triggers, AI chat input/send, and any KPI numbers displayed."
  ],

  "appendix_general_ui_ux_design_guidelines": "<General UI UX Design Guidelines>  \n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
