import axios from "axios";

const baseUrl = `https://www.castsense.xyz`;

export async function getChannelStats(props: { channelId: string }) {
  return axios
    .get<CastSenseResponse>(`${baseUrl}/api/channel/${props.channelId}/stats`)
    .then((res) => res.data)
    .then((data) => new Promise((resolve) => setTimeout(() => resolve(data), 3000)));
}

export type CastSenseResponse = {
  casts_percentage_change: number;
  channel_url: string;
  current_period_casts: number;
  current_period_followers: null;
  current_period_likes: number;
  current_period_mentions: null;
  current_period_recasts: number;
  current_period_replies: number;
  followers_percentage_change: null;
  likes_percentage_change: number;
  mentions_percentage_change: number | null;
  recasts_percentage_change: number;
  replies_percentage_change: number;
  churn_rate: {
    channel_url: string;
    churn_rate: string;
    churned_users: number;
    last_month_users: number;
    retention_rate: string;
    this_month_users: number;
  };
};
