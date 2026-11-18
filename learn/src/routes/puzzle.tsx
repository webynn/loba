import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/puzzle')({ beforeLoad: () => { throw redirect({ to: '/practice/puzzle', replace: true }) } })
