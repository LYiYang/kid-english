import type { Member } from '../types'

export function MemberAvatar({
  member,
  size = 36,
}: {
  member: Pick<Member, 'avatar' | 'color'>
  size?: number
}) {
  return (
    <span
      className="member-avatar"
      style={{ backgroundColor: member.color, width: size, height: size, fontSize: size * 0.55 }}
      aria-hidden="true"
    >
      {member.avatar}
    </span>
  )
}
