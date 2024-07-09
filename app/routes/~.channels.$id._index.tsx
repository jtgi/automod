/* eslint-disable @typescript-eslint/no-explicit-any */
import { LoaderFunctionArgs } from "@remix-run/node";
import { abbreviateNumber } from "js-abbreviation-number";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

import { typeddefer, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import {
  getSharedEnv,
  requireUser,
  requireUserCanModerateChannel as requireUserCanModerateChannel,
} from "~/lib/utils.server";
import { Await, ClientLoaderFunctionArgs } from "@remix-run/react";
import { actionDefinitions } from "~/lib/validations.server";
import { HeartIcon, MessageCircle, RefreshCcw, User } from "lucide-react";
import { cn } from "~/lib/utils";
import { CastSenseResponse, getChannelStats, getTopEngagers } from "~/lib/castsense.server";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { User as NeynarUser } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { ModerationStats30Days, getModerationStats30Days } from "~/lib/stats.server";
import { Badge } from "~/components/ui/badge";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const channel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  const stats = getChannelStats({ channelId: channel.id });
  const topUsers = getTopEngagers({ channelId: channel.id });
  const moderationStats = getModerationStats30Days({ channelId: channel.id });

  return typeddefer({
    user,
    channel,
    actionDefinitions: actionDefinitions,
    env: getSharedEnv(),
    channelStats: stats,
    moderationStats,
    topUsers,
  });
}

export default function Screen() {
  const { channelStats, channel, topUsers, moderationStats } = useTypedLoaderData<typeof loader>();

  return (
    <div>
      <Badge variant={"secondary"}>Last 30 days</Badge>

      {moderationStats !== null && (
        <div className="mt-6">
          <div>
            <p className="mb-1 font-medium">Moderation</p>
          </div>
          <Suspense fallback={<ActivityStatsLoading />}>
            <Await resolve={moderationStats!}>
              {(moderationStats) => <ActivityStats stats={moderationStats!} />}
            </Await>
          </Suspense>
        </div>
      )}

      <div className="mt-8">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="font-medium">Engagement</p>
          </div>
          <p className="text-xs text-muted-foreground text-right">
            Powered by{" "}
            <a href={`https://castsense.xyz/channel/${channel.id}`} target="_blank" rel="noreferrer">
              CastSense
            </a>
          </p>
        </div>

        <div className="space-y-4">
          <Suspense fallback={<StatsLoading />}>
            <Await resolve={channelStats} errorElement={<StatsError />}>
              {(channelStats) => <ChannelStats channelId={channel.id} stats={channelStats} />}
            </Await>
          </Suspense>

          <Suspense fallback={<TopEngagersLoading />}>
            <Await resolve={topUsers} errorElement={<TopEngagersError />}>
              {(topUsers) => <TopEngagers channelId={channel.id} users={topUsers.results} />}
            </Await>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function TopEngagersError() {
  return (
    <div className="flex flex-auto gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Top Casters</CardTitle>
          <CardDescription>No data available yet.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function TopEngagersLoading() {
  return (
    <div className="flex flex-auto gap-4">
      <Card className="w-full">
        <CardHeader>
          <div className="flex flex-col gap-2">
            <Skeleton className="w-[75px] h-[10px] rounded-full" />
            <Skeleton className="w-[150px] h-[10px] rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex gap-4 items-center w-full">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="flex flex-col gap-2 w-full">
                <Skeleton className="w-[100px] h-[10px] rounded-full" />
                <Skeleton className="w-[150px] h-[10px] rounded-full" />
              </div>
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <Skeleton className="w-[50px] h-[10px] rounded-full" />
        </CardFooter>
      </Card>
    </div>
  );
}

function TopEngagers(props: {
  channelId: string;
  users: Array<{ profile: NeynarUser } & { likes: number; recasts: number; replies: number }>;
}) {
  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Top Casters</CardTitle>
          <CardDescription>Most engaging casters in the past 30 days.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y grid grid-cols-1 md:grid-cols-2">
            {props.users.map((user, i) => (
              <div className="flex py-2 gap-2" key={i}>
                <div className="relative">
                  <div
                    className="absolute -left-1 z-10 top-0 flex items-center justify-center w-[16px] h-[16px] rounded-full text-white bg-orange-500 text-[9px]"
                    style={{ fontFamily: "Kode Mono" }}
                  >
                    {i + 1}
                  </div>
                  <a
                    className="no-underline"
                    target="_blank"
                    href={`https://warpcast.com/${user.profile.username}`}
                    rel="noreferrer"
                  >
                    <Avatar className="block w-11 h-11">
                      <AvatarImage
                        src={user.profile.pfp_url ?? undefined}
                        alt={"@" + user.profile.username}
                      />
                      <AvatarFallback className="uppercase">
                        {user.profile.username.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  </a>
                </div>

                <div className="flex flex-col">
                  <p className="font-medium">
                    <a
                      href={`https://warpcast.com/${user.profile.username}`}
                      target="_blank"
                      className="no-underline text-foreground"
                      rel="noreferrer"
                    >
                      {user.profile.username}
                    </a>
                  </p>
                  <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                    <div className="flex gap-1 items-center">
                      <HeartIcon className="w-3 h-3" />
                      <span>{abbreviateNumber(user.likes)}</span>
                    </div>
                    <div className="flex gap-1 items-center">
                      <RefreshCcw className="w-3 h-3" />
                      <span>{abbreviateNumber(user.recasts)}</span>
                    </div>
                    <div className="flex gap-1 items-center">
                      <MessageCircle className="w-3 h-3" />
                      <span>{abbreviateNumber(user.replies)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="text-xs">
          <p className="text-muted-foreground">
            Powered by <a href={`https://castsense.xyz/channels/${props.channelId}`}>CastSense</a>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

function StatsError() {
  return (
    <div className="grid w-full">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Channel Stats</CardTitle>
          <CardDescription>Not data available yet.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function StatsLoading() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="w-full">
          <CardHeader>
            <Skeleton className="w-[50px] h-[10px] rounded-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="w-[75px] h-[10px] rounded-full" />
          </CardContent>
          <CardFooter>
            <Skeleton className="w-[50px] h-[10px] rounded-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function ChannelStats(props: { channelId: string; stats: CastSenseResponse }) {
  const { stats } = props;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="w-md sm:w-lg">
        <CardHeader className="pb-2">
          <CardDescription>Followers</CardDescription>
          <CardTitle className="text-2xl" style={{ fontFamily: "Kode Mono" }}>
            {abbreviateNumber(stats.total_followers)}
          </CardTitle>
        </CardHeader>
      </Card>

      <Card className="w-md sm:w-lg">
        <CardHeader className="pb-2">
          <CardDescription>Casts</CardDescription>
          <CardTitle className="text-2xl" style={{ fontFamily: "Kode Mono" }}>
            {abbreviateNumber(stats.current_period_casts)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className={cn("text-xs text-muted-foreground border-b border-dashed")}>
                  {stats.casts_percentage_change < 0 ? "" : "+"}
                  {Math.round(stats.casts_percentage_change)}%
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Compared to previous 30 day period.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardContent>
      </Card>

      <Card className="w-md sm:w-lg">
        <CardHeader className="pb-2">
          <CardDescription>Likes</CardDescription>
          <CardTitle className="text-2xl" style={{ fontFamily: "Kode Mono" }}>
            {abbreviateNumber(stats.current_period_likes)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className={cn("text-xs text-muted-foreground border-b border-dashed")}>
                  {stats.likes_percentage_change < 0 ? "" : "+"}
                  {Math.round(stats.likes_percentage_change)}%
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Compared to previous 30 day period.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardContent>
      </Card>

      <Card className="w-md sm:w-lg">
        <CardHeader className="pb-2">
          <CardDescription>Replies</CardDescription>
          <CardTitle className="text-2xl" style={{ fontFamily: "Kode Mono" }}>
            {abbreviateNumber(stats.current_period_replies)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className={cn("text-xs text-muted-foreground border-b border-dashed")}>
                  {stats.replies_percentage_change < 0 ? "" : "+"}
                  {Math.round(stats.replies_percentage_change)}%
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Compared to previous 30 day period.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );
}

export function ActivityStatsLoading() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i} className="w-full">
          <CardHeader className="flex flex-col gap-4">
            <Skeleton className="w-[75px] h-[10px] rounded-full" />
            <Skeleton className="w-[50px] h-[10px] rounded-full" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export function ActivityStats(props: { stats: ModerationStats30Days }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="w-md sm:w-lg">
        <CardHeader>
          <CardDescription>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="border-b border-dashed">Curation Rate</TooltipTrigger>
                <TooltipContent>
                  <p>The % of casts into the channel that are curated into Main</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardDescription>
          <CardTitle className="text-2xl" style={{ fontFamily: "Kode Mono" }}>
            {Math.round(props.stats.approvalRate * 100)}%
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className="w-md sm:w-lg">
        <CardHeader>
          <CardDescription>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="border-b border-dashed">Curated Casters</TooltipTrigger>
                <TooltipContent>
                  <p>The unique number of users who have had casts curated into Main.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardDescription>
          <CardTitle className="text-2xl" style={{ fontFamily: "Kode Mono" }}>
            {abbreviateNumber(props.stats.uniqueCasters)}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
