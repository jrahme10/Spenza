import { useEffect, useState } from 'react'
import { Mail, Plus, Users } from 'lucide-react'
import { getSupabaseClient } from '../lib/supabaseClient'
type Household = { id: string; name: string }
type Invite = { id: string; invite_email: string; status: string }
export default function FamilyManager() {
  const [household, setHousehold] = useState<Household | null>(null),
    [invites, setInvites] = useState<Invite[]>([]),
    [email, setEmail] = useState(''),
    [status, setStatus] = useState('')
  const load = async () => {
    const s = getSupabaseClient()
    if (!s) return
    const {
      data: { session },
    } = await s.auth.getSession()
    if (!session) return
    const { data } = await s
      .from('spenza_households')
      .select('id,name')
      .eq('owner_id', session.user.id)
      .maybeSingle()
    if (data) {
      setHousehold(data)
      const r = await s
        .from('spenza_household_invites')
        .select('id,invite_email,status')
        .eq('household_id', data.id)
        .order('created_at', { ascending: false })
      setInvites(r.data || [])
    }
  }
  useEffect(() => {
    void load()
  }, [])
  const create = async () => {
    const s = getSupabaseClient()
    if (!s) {
      setStatus('Sign in to Cloud Sync first.')
      return
    }
    const {
      data: { session },
    } = await s.auth.getSession()
    if (!session) {
      setStatus('Sign in to Cloud Sync first.')
      return
    }
    const { data, error } = await s
      .from('spenza_households')
      .insert({ owner_id: session.user.id, name: 'My Family' })
      .select('id,name')
      .single()
    if (error) {
      setStatus(error.message)
      return
    }
    setHousehold(data)
    setStatus('Family space created.')
  }
  const invite = async () => {
    if (!household || !email.trim()) return
    const s = getSupabaseClient()
    if (!s) return
    const {
      data: { session },
    } = await s.auth.getSession()
    if (!session) return
    const { error } = await s
      .from('spenza_household_invites')
      .insert({
        household_id: household.id,
        inviter_id: session.user.id,
        invite_email: email.trim().toLowerCase(),
      })
    if (error) {
      setStatus(error.message)
      return
    }
    setEmail('')
    setStatus('Invite recorded. Email delivery will activate with the Family billing release.')
    void load()
  }
  return (
    <section className="familyManager">
      <div className="familyHead">
        <Users />
        <div>
          <b>Family & Shared</b>
          <small>Prepare a shared household space</small>
        </div>
      </div>
      {!household ? (
        <button className="familyCreate" onClick={() => void create()}>
          <Plus />
          Create Family Space
        </button>
      ) : (
        <>
          <div className="familySpace">
            <b>{household.name}</b>
            <small>Owner</small>
          </div>
          <div className="familyInvite">
            <Mail />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="family@email.com"
            />
            <button onClick={() => void invite()}>Invite</button>
          </div>
          {invites.slice(0, 4).map((i) => (
            <div className="familyInviteRow" key={i.id}>
              <span>{i.invite_email}</span>
              <small>{i.status}</small>
            </div>
          ))}
        </>
      )}
      {status && <small className="familyStatus">{status}</small>}
    </section>
  )
}
