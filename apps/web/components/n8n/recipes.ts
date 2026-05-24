export interface N8nRecipe {
  key: string;
  emoji: string;
  title: string;
  description: string;
  event: string;
  filename: string;
  workflow: string;
}

export const N8N_RECIPES: N8nRecipe[] = [
  {
    key: "auto_reply",
    emoji: "🤖",
    title: "Filter pesan masuk",
    description:
      "Tangkap message.received, cek event, lalu ekstrak teks untuk diproses lanjut.",
    event: "message.received",
    filename: "aichat-auto-reply.json",
    workflow: `{
  "name": "AI Chat → Filter pesan masuk",
  "nodes": [
    {
      "parameters": { "httpMethod": "POST", "path": "aichat", "responseMode": "onReceived", "options": {} },
      "name": "AI Chat Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300],
      "webhookId": "aichat"
    },
    {
      "parameters": {
        "conditions": { "string": [ { "value1": "={{ $json[\\"event\\"] }}", "value2": "message.received" } ] }
      },
      "name": "Is inbound message?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [500, 300]
    },
    {
      "parameters": {
        "values": { "string": [ { "name": "text", "value": "={{ $json[\\"data\\"][\\"body\\"] }}" } ] },
        "options": {}
      },
      "name": "Extract message",
      "type": "n8n-nodes-base.set",
      "typeVersion": 2,
      "position": [750, 250]
    }
  ],
  "connections": {
    "AI Chat Webhook": { "main": [[{ "node": "Is inbound message?", "type": "main", "index": 0 }]] },
    "Is inbound message?": { "main": [[{ "node": "Extract message", "type": "main", "index": 0 }]] }
  }
}`,
  },
  {
    key: "lead_sheets",
    emoji: "📊",
    title: "Lead baru → Google Sheets",
    description:
      "Saat contact.created, tambahkan baris ke spreadsheet sebagai lead tracker.",
    event: "contact.created",
    filename: "aichat-lead-to-sheets.json",
    workflow: `{
  "name": "AI Chat → Lead ke Google Sheets",
  "nodes": [
    {
      "parameters": { "httpMethod": "POST", "path": "aichat-lead", "responseMode": "onReceived", "options": {} },
      "name": "AI Chat Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300],
      "webhookId": "aichat-lead"
    },
    {
      "parameters": {
        "conditions": { "string": [ { "value1": "={{ $json[\\"event\\"] }}", "value2": "contact.created" } ] }
      },
      "name": "Is new contact?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [500, 300]
    },
    {
      "parameters": {
        "operation": "append",
        "documentId": "<SPREADSHEET_ID>",
        "sheetName": "Leads",
        "columns": {
          "mappingMode": "defineBelow",
          "value": {
            "Nama": "={{ $json[\\"data\\"][\\"name\\"] }}",
            "Telepon": "={{ $json[\\"data\\"][\\"phone\\"] }}",
            "Email": "={{ $json[\\"data\\"][\\"email\\"] }}",
            "Waktu": "={{ $json[\\"occurred_at\\"] }}"
          }
        }
      },
      "name": "Append to Sheet",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4,
      "position": [750, 250]
    }
  ],
  "connections": {
    "AI Chat Webhook": { "main": [[{ "node": "Is new contact?", "type": "main", "index": 0 }]] },
    "Is new contact?": { "main": [[{ "node": "Append to Sheet", "type": "main", "index": 0 }]] }
  }
}`,
  },
  {
    key: "slack_alert",
    emoji: "🔔",
    title: "Alert Slack saat pesan masuk",
    description:
      "Kirim notifikasi ke channel Slack setiap ada pesan masuk dari pelanggan.",
    event: "message.received",
    filename: "aichat-slack-alert.json",
    workflow: `{
  "name": "AI Chat → Alert Slack",
  "nodes": [
    {
      "parameters": { "httpMethod": "POST", "path": "aichat-slack", "responseMode": "onReceived", "options": {} },
      "name": "AI Chat Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300],
      "webhookId": "aichat-slack"
    },
    {
      "parameters": {
        "conditions": { "string": [ { "value1": "={{ $json[\\"event\\"] }}", "value2": "message.received" } ] }
      },
      "name": "Is inbound message?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [500, 300]
    },
    {
      "parameters": {
        "select": "channel",
        "channelId": "#cs-inbox",
        "text": "=📩 Pesan baru: {{ $json[\\"data\\"][\\"body\\"] }}"
      },
      "name": "Notify Slack",
      "type": "n8n-nodes-base.slack",
      "typeVersion": 2,
      "position": [750, 250]
    }
  ],
  "connections": {
    "AI Chat Webhook": { "main": [[{ "node": "Is inbound message?", "type": "main", "index": 0 }]] },
    "Is inbound message?": { "main": [[{ "node": "Notify Slack", "type": "main", "index": 0 }]] }
  }
}`,
  },
];
