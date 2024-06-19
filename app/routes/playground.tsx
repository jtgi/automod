import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { UserSelector } from "~/routes/resources.farcasterUserSelector";

export default function Screen() {
  const [users, setUsers] = useState<User[]>([]);
  return (
    <div>
      <UserSelector
        onSelect={(user) => {
          setUsers([...users, user]);
        }}
      />
      {users.map((user) => (
        <div key={user.fid} className="flex gap-4">
          <Avatar>
            <AvatarImage src={user.pfp_url} />
            <AvatarFallback>{user.username}</AvatarFallback>
          </Avatar>
          <div>
            <p>
              {user.display_name} (@{user.username})
            </p>
            <span className="text-gray-500">#{user.fid}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
