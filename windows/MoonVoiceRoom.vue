<template>
  <section class="moon-voice-room" aria-labelledby="moon-voice-title">
    <header class="moon-voice-room__header">
      <div>
        <h2 id="moon-voice-title"><v-icon aria-hidden="true">graphic_eq</v-icon> Voice room</h2>
        <p>Private voice | up to 8 people</p>
      </div>
      <span v-if="currentRoom" class="moon-voice-room__count">{{ participants.length }}/8</span>
    </header>

    <div v-if="!currentRoom" class="moon-voice-room__form">
      <label>
        Voice service URL
        <input v-model="serviceUrl" type="url" placeholder="https://voice-api.example.com" autocomplete="url" spellcheck="false" />
      </label>
      <label>
        Display name
        <input v-model="displayName" type="text" maxlength="32" autocomplete="nickname" />
      </label>
      <label>
        Invite code
        <input v-model="inviteCode" type="text" maxlength="10" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="For joining a room" />
      </label>
      <div class="moon-voice-room__actions">
        <button type="button" :disabled="busy || !canConnect" @click="connect('create')"><v-icon aria-hidden="true">add</v-icon> Create room</button>
        <button type="button" class="moon-voice-room__secondary" :disabled="busy || !canJoin" @click="connect('join')"><v-icon aria-hidden="true">login</v-icon> Join room</button>
      </div>
    </div>

    <div v-else class="moon-voice-room__active">
      <div class="moon-voice-room__invite">
        <span>Invite code</span>
        <button type="button" class="moon-voice-room__code" aria-label="Copy invite code" @click="copyInviteCode">
          {{ activeCode }} <v-icon aria-hidden="true" size="16">content_copy</v-icon>
        </button>
      </div>
      <ul class="moon-voice-room__participants" aria-label="Participants">
        <li v-for="participant in participants" :key="participant">{{ participant }}</li>
      </ul>
      <div class="moon-voice-room__actions">
        <button type="button" @click="toggleMicrophone"><v-icon aria-hidden="true">{{ microphoneMuted ? 'mic' : 'mic_off' }}</v-icon> {{ microphoneMuted ? 'Unmute microphone' : 'Mute microphone' }}</button>
        <button type="button" class="moon-voice-room__secondary" @click="leaveRoom"><v-icon aria-hidden="true">logout</v-icon> Leave room</button>
      </div>
    </div>

    <p v-if="message" class="moon-voice-room__message" role="status">{{ message }}</p>
  </section>
</template>

<script setup lang="ts">
import { Room, RoomEvent, Track } from 'livekit-client'

const storageKey = 'moon.voice.serviceUrl'
const serviceUrl = ref(localStorage.getItem(storageKey) || '')
const displayName = ref(localStorage.getItem('moon.voice.displayName') || '')
const inviteCode = ref('')
const activeCode = ref('')
const currentRoom = shallowRef<Room | undefined>(undefined)
const participants = ref<string[]>([])
const microphoneMuted = ref(false)
const busy = ref(false)
const message = ref('')

const canConnect = computed(() => serviceUrl.value.trim().length > 0 && displayName.value.trim().length > 0)
const canJoin = computed(() => canConnect.value && /^[A-Z0-9]{10}$/.test(inviteCode.value.trim().toUpperCase()))

function getServiceBase() {
  const value = serviceUrl.value.trim().replace(/\/+$/, '')
  const url = new URL(value)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('Use an HTTPS voice service URL.')
  }
  localStorage.setItem(storageKey, value)
  localStorage.setItem('moon.voice.displayName', displayName.value.trim())
  return value
}

function refreshParticipants() {
  const room = currentRoom.value
  participants.value = room
    ? [room.localParticipant, ...room.remoteParticipants.values()].map((participant) => participant.name || participant.identity)
    : []
}

function detachAudio() {
  document.querySelectorAll('[data-moon-voice-track]').forEach((element) => element.remove())
}

async function connect(action: 'create' | 'join') {
  if (busy.value || !canConnect.value) return
  busy.value = true
  message.value = ''
  let room: Room | undefined
  try {
    const base = getServiceBase()
    const response = await fetch(`${base}/api/rooms${action === 'join' ? '/join' : ''}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: displayName.value.trim(),
        ...(action === 'join' ? { code: inviteCode.value.trim().toUpperCase() } : {}),
      }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || `Voice service returned HTTP ${response.status}.`)

    room = new Room({ adaptiveStream: true, dynacast: true })
    currentRoom.value = room
    activeCode.value = result.code
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        const element = track.attach()
        element.autoplay = true
        element.dataset.moonVoiceTrack = 'true'
        document.body.appendChild(element)
      }
    })
    room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((element) => element.remove()))
    room.on(RoomEvent.ParticipantConnected, refreshParticipants)
    room.on(RoomEvent.ParticipantDisconnected, refreshParticipants)
    room.on(RoomEvent.Disconnected, () => {
      currentRoom.value = undefined
      activeCode.value = ''
      microphoneMuted.value = false
      participants.value = []
      detachAudio()
    })

    await room.connect(result.livekitUrl, result.token)
    await room.localParticipant.setMicrophoneEnabled(true)
    microphoneMuted.value = false
    refreshParticipants()
  } catch (error) {
    if (room) await room.disconnect().catch(() => undefined)
    currentRoom.value = undefined
    activeCode.value = ''
    participants.value = []
    detachAudio()
    message.value = error instanceof Error ? error.message : 'Could not connect to the voice room.'
  } finally {
    busy.value = false
  }
}

async function toggleMicrophone() {
  const room = currentRoom.value
  if (!room) return
  try {
    const enabled = microphoneMuted.value
    await room.localParticipant.setMicrophoneEnabled(enabled)
    microphoneMuted.value = !enabled
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Could not change microphone state.'
  }
}

async function leaveRoom() {
  await currentRoom.value?.disconnect()
}

async function copyInviteCode() {
  try {
    await navigator.clipboard.writeText(activeCode.value)
    message.value = 'Invite code copied.'
  } catch {
    message.value = 'Could not copy the invite code.'
  }
}

onBeforeUnmount(() => {
  void currentRoom.value?.disconnect()
  detachAudio()
})
</script>

<style scoped>
.moon-voice-room {
  padding: 18px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.14);
  border-radius: 6px;
  background: rgba(var(--v-theme-surface), 0.76);
  color: rgb(var(--v-theme-on-surface));
}

.moon-voice-room__header,
.moon-voice-room__actions,
.moon-voice-room__invite {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.moon-voice-room__header h2 {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  font-size: 18px;
  font-weight: 650;
}

.moon-voice-room__header p,
.moon-voice-room__invite span {
  margin: 4px 0 0;
  color: rgba(var(--v-theme-on-surface), 0.68);
  font-size: 13px;
}

.moon-voice-room__count {
  flex: none;
  font-variant-numeric: tabular-nums;
}

.moon-voice-room__form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.moon-voice-room label {
  display: grid;
  min-width: 0;
  gap: 6px;
  font-size: 13px;
}

.moon-voice-room input {
  width: 100%;
  min-width: 0;
  min-height: 40px;
  padding: 0 10px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.24);
  border-radius: 4px;
  background: rgba(var(--v-theme-surface), 0.92);
  color: inherit;
  font: inherit;
}

.moon-voice-room input:focus-visible,
.moon-voice-room button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.moon-voice-room__actions {
  grid-column: 1 / -1;
  justify-content: flex-start;
}

.moon-voice-room button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 13px;
  border: 0;
  border-radius: 4px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font: inherit;
  cursor: pointer;
}

.moon-voice-room button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.moon-voice-room button.moon-voice-room__secondary,
.moon-voice-room button.moon-voice-room__code {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.24);
  background: transparent;
  color: inherit;
}

.moon-voice-room button .v-icon {
  color: rgb(var(--v-theme-accent));
}

.moon-voice-room__active {
  margin-top: 14px;
}

.moon-voice-room__invite {
  justify-content: flex-start;
}

.moon-voice-room__code {
  font-variant-numeric: tabular-nums;
}

.moon-voice-room__participants {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0;
  padding: 0;
  list-style: none;
}

.moon-voice-room__participants li {
  padding: 6px 9px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.08);
}

.moon-voice-room__message {
  margin: 12px 0 0;
  color: rgb(var(--v-theme-primary));
  font-size: 13px;
  overflow-wrap: anywhere;
}

@media (max-width: 760px) {
  .moon-voice-room__form {
    grid-template-columns: 1fr;
  }

  .moon-voice-room__actions {
    grid-column: auto;
    flex-wrap: wrap;
  }
}
</style>
