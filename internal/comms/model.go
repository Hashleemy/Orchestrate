package comms

import "time"

type MessageType string

const (
	MsgQuestion  MessageType = "question"
	MsgAnswer    MessageType = "answer"
	MsgBroadcast MessageType = "broadcast"
	MsgStatus    MessageType = "status"
	MsgBlock     MessageType = "block"
)

type Message struct {
	Timestamp time.Time   `json:"timestamp"`
	From      string      `json:"from"`
	To        string      `json:"to"`
	Type      MessageType `json:"type"`
	TaskID    string      `json:"task_id"`
	Priority  string      `json:"priority"`
	Body      string      `json:"body"`
}
