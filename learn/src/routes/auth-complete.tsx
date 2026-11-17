import { createFileRoute, redirect } from '@tanstack/react-router'
import { meQuery } from '../account/api'
import { adopt, uploadNow } from '../account/sync'
import { actions, game } from '../game/store'

export const Route = createFileRoute('/auth-complete')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery({ ...meQuery, staleTime: 0 })
    if (!me.learner) throw redirect({ to: '/account', search: { mode: 'login' } })
    const restored = adopt(me.progress)
    if (!restored) {
      actions.setProfile(me.learner.name, game.get().avatar)
      if (game.get().onboarded) await uploadNow(context.queryClient)
    }
    throw redirect({ to: game.get().onboarded ? '/profile' : '/welcome' })
  },
})
