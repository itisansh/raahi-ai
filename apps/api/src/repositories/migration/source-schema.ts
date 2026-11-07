// Generated from the unchanged Prisma snapshot for M4 v1; regenerate when versioning the importer.
export const sourceSchemaHash = "092b80317df94be6a56a2b9ceec6805804185628977b57aac532c424eea8f70d";
export const sourceSchemaColumns = {
  "account": [
    {
      "name": "id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "accountId",
      "type": "String",
      "nullable": false
    },
    {
      "name": "providerId",
      "type": "String",
      "nullable": false
    },
    {
      "name": "userId",
      "type": "String",
      "nullable": false
    },
    {
      "name": "accessToken",
      "type": "String",
      "nullable": true
    },
    {
      "name": "refreshToken",
      "type": "String",
      "nullable": true
    },
    {
      "name": "idToken",
      "type": "String",
      "nullable": true
    },
    {
      "name": "accessTokenExpiresAt",
      "type": "DateTime",
      "nullable": true
    },
    {
      "name": "refreshTokenExpiresAt",
      "type": "DateTime",
      "nullable": true
    },
    {
      "name": "scope",
      "type": "String",
      "nullable": true
    },
    {
      "name": "password",
      "type": "String",
      "nullable": true
    },
    {
      "name": "createdAt",
      "type": "DateTime",
      "nullable": false
    },
    {
      "name": "updatedAt",
      "type": "DateTime",
      "nullable": false
    }
  ],
  "agent_messages": [
    {
      "name": "id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "seq",
      "type": "BigInt",
      "nullable": false
    },
    {
      "name": "trip_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "role",
      "type": "String",
      "nullable": false
    },
    {
      "name": "parts",
      "type": "Json",
      "nullable": false
    },
    {
      "name": "actor_user_id",
      "type": "String",
      "nullable": true
    },
    {
      "name": "source",
      "type": "String",
      "nullable": false
    },
    {
      "name": "trip_version",
      "type": "Int",
      "nullable": false
    },
    {
      "name": "created_at",
      "type": "DateTime",
      "nullable": false
    }
  ],
  "agent_suggestion_dismissals": [
    {
      "name": "suggestion_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "user_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "dismissed_at",
      "type": "DateTime",
      "nullable": false
    }
  ],
  "agent_suggestions": [
    {
      "name": "id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "trip_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "message_id",
      "type": "String",
      "nullable": true
    },
    {
      "name": "status",
      "type": "String",
      "nullable": false
    },
    {
      "name": "severity",
      "type": "String",
      "nullable": false
    },
    {
      "name": "confidence",
      "type": "Float",
      "nullable": false
    },
    {
      "name": "reason",
      "type": "String",
      "nullable": false
    },
    {
      "name": "suggestion_text",
      "type": "String",
      "nullable": false
    },
    {
      "name": "patch",
      "type": "Json",
      "nullable": false
    },
    {
      "name": "trip_version",
      "type": "Int",
      "nullable": false
    },
    {
      "name": "expires_at",
      "type": "DateTime",
      "nullable": true
    },
    {
      "name": "applied_by",
      "type": "String",
      "nullable": true
    },
    {
      "name": "applied_at",
      "type": "DateTime",
      "nullable": true
    },
    {
      "name": "created_at",
      "type": "DateTime",
      "nullable": false
    },
    {
      "name": "updated_at",
      "type": "DateTime",
      "nullable": false
    }
  ],
  "expense_participants": [
    {
      "name": "expense_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "member_id",
      "type": "String",
      "nullable": false
    }
  ],
  "expenses": [
    {
      "name": "id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "trip_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "description",
      "type": "String",
      "nullable": false
    },
    {
      "name": "payer_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "amount",
      "type": "Decimal",
      "nullable": false
    },
    {
      "name": "when_label",
      "type": "String",
      "nullable": false
    },
    {
      "name": "sort_order",
      "type": "Int",
      "nullable": false
    },
    {
      "name": "currency",
      "type": "String",
      "nullable": false
    },
    {
      "name": "category",
      "type": "String",
      "nullable": false
    },
    {
      "name": "allocations",
      "type": "Json",
      "nullable": true
    }
  ],
  "reservations": [
    {
      "name": "id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "trip_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "type",
      "type": "String",
      "nullable": false
    },
    {
      "name": "status",
      "type": "String",
      "nullable": false
    },
    {
      "name": "title",
      "type": "String",
      "nullable": false
    },
    {
      "name": "provider",
      "type": "String",
      "nullable": false
    },
    {
      "name": "confirmation_number",
      "type": "String",
      "nullable": false
    },
    {
      "name": "start_at",
      "type": "DateTime",
      "nullable": false
    },
    {
      "name": "end_at",
      "type": "DateTime",
      "nullable": true
    },
    {
      "name": "timezone",
      "type": "String",
      "nullable": false
    },
    {
      "name": "location_name",
      "type": "String",
      "nullable": false
    },
    {
      "name": "address",
      "type": "String",
      "nullable": false
    },
    {
      "name": "latitude",
      "type": "Float",
      "nullable": true
    },
    {
      "name": "longitude",
      "type": "Float",
      "nullable": true
    },
    {
      "name": "day_number",
      "type": "Int",
      "nullable": true
    },
    {
      "name": "stop_id",
      "type": "String",
      "nullable": true
    },
    {
      "name": "expense_id",
      "type": "String",
      "nullable": true
    },
    {
      "name": "amount_minor",
      "type": "BigInt",
      "nullable": true
    },
    {
      "name": "currency",
      "type": "String",
      "nullable": true
    },
    {
      "name": "notes",
      "type": "String",
      "nullable": false
    },
    {
      "name": "created_by",
      "type": "String",
      "nullable": false
    },
    {
      "name": "idempotency_key",
      "type": "String",
      "nullable": false
    },
    {
      "name": "created_at",
      "type": "DateTime",
      "nullable": false
    },
    {
      "name": "updated_at",
      "type": "DateTime",
      "nullable": false
    },
    {
      "name": "revision",
      "type": "Int",
      "nullable": false
    }
  ],
  "schema_migrations": [
    {
      "name": "name",
      "type": "String",
      "nullable": false
    },
    {
      "name": "applied_at",
      "type": "DateTime",
      "nullable": false
    }
  ],
  "session": [
    {
      "name": "id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "expiresAt",
      "type": "DateTime",
      "nullable": false
    },
    {
      "name": "token",
      "type": "String",
      "nullable": false
    },
    {
      "name": "createdAt",
      "type": "DateTime",
      "nullable": false
    },
    {
      "name": "updatedAt",
      "type": "DateTime",
      "nullable": false
    },
    {
      "name": "ipAddress",
      "type": "String",
      "nullable": true
    },
    {
      "name": "userAgent",
      "type": "String",
      "nullable": true
    },
    {
      "name": "userId",
      "type": "String",
      "nullable": false
    }
  ],
  "stop_comments": [
    {
      "name": "id",
      "type": "BigInt",
      "nullable": false
    },
    {
      "name": "stop_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "author_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "text",
      "type": "String",
      "nullable": false
    },
    {
      "name": "time_label",
      "type": "String",
      "nullable": false
    },
    {
      "name": "created_at",
      "type": "DateTime",
      "nullable": false
    }
  ],
  "stop_votes": [
    {
      "name": "stop_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "member_id",
      "type": "String",
      "nullable": false
    }
  ],
  "stops": [
    {
      "name": "id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "trip_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "day",
      "type": "Int",
      "nullable": false
    },
    {
      "name": "time",
      "type": "String",
      "nullable": false
    },
    {
      "name": "duration",
      "type": "String",
      "nullable": false
    },
    {
      "name": "name",
      "type": "String",
      "nullable": false
    },
    {
      "name": "area",
      "type": "String",
      "nullable": false
    },
    {
      "name": "category",
      "type": "String",
      "nullable": false
    },
    {
      "name": "lat",
      "type": "Float",
      "nullable": false
    },
    {
      "name": "lng",
      "type": "Float",
      "nullable": false
    },
    {
      "name": "cost",
      "type": "Int",
      "nullable": false
    },
    {
      "name": "created_by",
      "type": "String",
      "nullable": false
    },
    {
      "name": "transit",
      "type": "Boolean",
      "nullable": false
    },
    {
      "name": "note",
      "type": "String",
      "nullable": false
    },
    {
      "name": "sort_order",
      "type": "Int",
      "nullable": false
    },
    {
      "name": "cost_currency",
      "type": "String",
      "nullable": false
    }
  ],
  "trip_days": [
    {
      "name": "trip_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "number",
      "type": "Int",
      "nullable": false
    },
    {
      "name": "date_label",
      "type": "String",
      "nullable": false
    },
    {
      "name": "city",
      "type": "String",
      "nullable": false
    },
    {
      "name": "color",
      "type": "String",
      "nullable": false
    },
    {
      "name": "date",
      "type": "String",
      "nullable": false
    }
  ],
  "trip_invite_acceptances": [
    {
      "name": "invite_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "user_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "accepted_at",
      "type": "DateTime",
      "nullable": false
    }
  ],
  "trip_invite_allowed_emails": [
    {
      "name": "invite_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "email",
      "type": "String",
      "nullable": false
    }
  ],
  "trip_invites": [
    {
      "name": "id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "trip_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "token_hash",
      "type": "String",
      "nullable": false
    },
    {
      "name": "created_by",
      "type": "String",
      "nullable": false
    },
    {
      "name": "access_scope",
      "type": "String",
      "nullable": false
    },
    {
      "name": "role",
      "type": "String",
      "nullable": false
    },
    {
      "name": "can_invite",
      "type": "Boolean",
      "nullable": false
    },
    {
      "name": "status",
      "type": "String",
      "nullable": false
    },
    {
      "name": "expires_at",
      "type": "DateTime",
      "nullable": true
    },
    {
      "name": "created_at",
      "type": "DateTime",
      "nullable": false
    }
  ],
  "trip_members": [
    {
      "name": "id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "trip_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "name",
      "type": "String",
      "nullable": false
    },
    {
      "name": "short_name",
      "type": "String",
      "nullable": false
    },
    {
      "name": "initials",
      "type": "String",
      "nullable": false
    },
    {
      "name": "avatar_bg",
      "type": "String",
      "nullable": false
    },
    {
      "name": "avatar_fg",
      "type": "String",
      "nullable": false
    },
    {
      "name": "is_current_user",
      "type": "Boolean",
      "nullable": false
    },
    {
      "name": "sort_order",
      "type": "Int",
      "nullable": false
    },
    {
      "name": "image",
      "type": "String",
      "nullable": true
    },
    {
      "name": "can_invite",
      "type": "Boolean",
      "nullable": false
    },
    {
      "name": "role",
      "type": "String",
      "nullable": false
    },
    {
      "name": "user_id",
      "type": "String",
      "nullable": true
    }
  ],
  "trips": [
    {
      "name": "id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "title",
      "type": "String",
      "nullable": false
    },
    {
      "name": "start_date",
      "type": "String",
      "nullable": false
    },
    {
      "name": "end_date",
      "type": "String",
      "nullable": false
    },
    {
      "name": "status",
      "type": "String",
      "nullable": false
    },
    {
      "name": "currency",
      "type": "String",
      "nullable": false
    },
    {
      "name": "cover_color",
      "type": "String",
      "nullable": false
    },
    {
      "name": "owner_id",
      "type": "String",
      "nullable": true
    },
    {
      "name": "created_at",
      "type": "DateTime",
      "nullable": false
    },
    {
      "name": "version",
      "type": "Int",
      "nullable": false
    },
    {
      "name": "agent_seed_pending",
      "type": "Boolean",
      "nullable": false
    },
    {
      "name": "cover_url",
      "type": "String",
      "nullable": true
    },
    {
      "name": "intake",
      "type": "Json",
      "nullable": true
    }
  ],
  "twoFactor": [
    {
      "name": "id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "secret",
      "type": "String",
      "nullable": false
    },
    {
      "name": "backupCodes",
      "type": "String",
      "nullable": false
    },
    {
      "name": "userId",
      "type": "String",
      "nullable": false
    },
    {
      "name": "verified",
      "type": "Boolean",
      "nullable": true
    },
    {
      "name": "failedVerificationCount",
      "type": "Int",
      "nullable": true
    },
    {
      "name": "lockedUntil",
      "type": "DateTime",
      "nullable": true
    }
  ],
  "user": [
    {
      "name": "id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "name",
      "type": "String",
      "nullable": false
    },
    {
      "name": "email",
      "type": "String",
      "nullable": false
    },
    {
      "name": "emailVerified",
      "type": "Boolean",
      "nullable": false
    },
    {
      "name": "image",
      "type": "String",
      "nullable": true
    },
    {
      "name": "createdAt",
      "type": "DateTime",
      "nullable": false
    },
    {
      "name": "updatedAt",
      "type": "DateTime",
      "nullable": false
    },
    {
      "name": "defaultCurrency",
      "type": "String",
      "nullable": false
    },
    {
      "name": "twoFactorEnabled",
      "type": "Boolean",
      "nullable": false
    }
  ],
  "user_preferences": [
    {
      "name": "user_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "planner_sidebar_width",
      "type": "Decimal",
      "nullable": false
    },
    {
      "name": "planner_sidebar_collapsed",
      "type": "Boolean",
      "nullable": false
    },
    {
      "name": "updated_at",
      "type": "DateTime",
      "nullable": false
    },
    {
      "name": "agent_panel_collapsed",
      "type": "Boolean",
      "nullable": false
    }
  ],
  "verification": [
    {
      "name": "id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "identifier",
      "type": "String",
      "nullable": false
    },
    {
      "name": "value",
      "type": "String",
      "nullable": false
    },
    {
      "name": "expiresAt",
      "type": "DateTime",
      "nullable": false
    },
    {
      "name": "createdAt",
      "type": "DateTime",
      "nullable": false
    },
    {
      "name": "updatedAt",
      "type": "DateTime",
      "nullable": false
    }
  ],
  "planning_proposals": [
    {
      "name": "id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "owner_id",
      "type": "String",
      "nullable": false
    },
    {
      "name": "payload",
      "type": "Json",
      "nullable": false
    },
    {
      "name": "context_trip_id",
      "type": "String",
      "nullable": true
    },
    {
      "name": "base_revision",
      "type": "Int",
      "nullable": true
    },
    {
      "name": "result_trip_id",
      "type": "String",
      "nullable": true
    },
    {
      "name": "created_at",
      "type": "DateTime",
      "nullable": false
    },
    {
      "name": "expires_at",
      "type": "DateTime",
      "nullable": false
    },
    {
      "name": "approved_at",
      "type": "DateTime",
      "nullable": true
    }
  ]
} as const;
