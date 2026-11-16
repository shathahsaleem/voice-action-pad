export interface ActionItem {
  id: string;
  session_id: string;
  text: string;
  previous_text: string | null;
  quantity: number | null;
  category: string;
  is_completed: boolean;
  correction_note: string | null;
  updated_at: string;
  created_at: string;
}

export interface VoiceSession {
  id: string;
  workspace_id: string;
  title: string;
  transcript: string;
  created_at: string;
  action_items?: ActionItem[];
}