import { CSSProperties } from "react";

// neynar gaps

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface MessageResponse {
  valid: boolean;
  action: FrameAction;
}

export interface FrameAction {
  object: string;
  interactor: Interactor;
  tapped_button: TappedButton;
  cast: Cast;
  url: string;
}

export interface Cast {
  object: string;
  hash: string;
  thread_hash: string;
  parent_hash: string;
  parent_url: null;
  root_parent_url: null;
  parent_author: ParentAuthor;
  author: Author;
  text: string;
  timestamp: Date;
  embeds: Embed[];
  frames?: Frame[];
  reactions: Reactions;
  replies: Replies;
  mentioned_profiles: any[];
  viewer_context: ViewerContext;
}

export interface Author {
  object: string;
  fid: number;
  custody_address: string;
  username: string;
  display_name: string;
  pfp_url: string;
  profile: AuthorProfile;
  follower_count: number;
  following_count: number;
  verifications: string[];
  active_status: string;
}

export interface AuthorProfile {
  bio: PurpleBio;
}

export interface PurpleBio {
  text: string;
  mentioned_profiles: any[];
}

export interface Embed {
  url: string;
}

export interface Frame {
  version: string;
  title: string;
  image: string;
  buttons: Button[];
  frames_url: string;
}

export interface Button {
  index: number;
  title: string;
  action_type: string;
}

export interface ParentAuthor {
  fid: string;
}

export interface Reactions {
  likes: Like[];
  recasts: any[];
}

export interface Like {
  fid: number;
  fname: string;
}

export interface Replies {
  count: number;
}

export interface ViewerContext {
  liked: boolean;
  recasted: boolean;
}

export interface Interactor {
  object: string;
  fid: number;
  custody_address: string;
  username: string;
  display_name: string;
  pfp_url: string;
  profile: InteractorProfile;
  follower_count: number;
  following_count: number;
  verifications: string[];
  active_status: string;
  viewer_context?: {
    following: boolean;
    followed_by: boolean;
  };
}

export interface InteractorProfile {
  bio: FluffyBio;
}

export interface FluffyBio {
  text: string;
}

export interface TappedButton {
  index: number;
}
