/** Represents a Microsoft To Do task list. */
export interface TaskList {
  id: string
  displayName: string
  isOwner?: boolean
  isShared?: boolean
  /** Possible values: 'none', 'defaultList', 'flaggedEmails', 'unknownFutureValue' */
  wellknownListName?: string
}

/** Represents a Microsoft To Do task. */
export interface Task {
  id: string
  title: string
  status: string
  importance: string
  dueDateTime?: {
    dateTime: string
    timeZone: string
  }
  completedDateTime?: {
    dateTime: string
    timeZone: string
  }
  reminderDateTime?: {
    dateTime: string
    timeZone: string
  }
  body?: {
    content: string
    contentType: string
  }
  categories?: string[]
}

/** Represents a checklist item (subtask) inside a Microsoft To Do task. */
export interface ChecklistItem {
  id: string
  displayName: string
  isChecked: boolean
  createdDateTime?: string
}
