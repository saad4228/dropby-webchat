import { Room } from "../lib/client";
export function RoomMark({
  room,
}: {
  room: Pick<Room, "slug" | "logo" | "logoImageId">;
}) {
  return room.logoImageId ? (
    <img
      className="room-logo-image"
      src={
        "/api/rooms/" +
        encodeURIComponent(room.slug) +
        "/logo?v=" +
        room.logoImageId
      }
      alt={room.slug + " room logo"}
    />
  ) : (
    <span className="room-logo-emoji">{room.logo || "✳"}</span>
  );
}
