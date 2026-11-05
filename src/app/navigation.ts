import { Apple, BookOpen, ChartNoAxesCombined, Dumbbell, LayoutDashboard, Utensils } from 'lucide-react'

export const navigation = [
  { path: '/', label: 'Overview', mobile: 'Home', Icon: LayoutDashboard },
  { path: '/food', label: 'Food diary', mobile: 'Food', Icon: Utensils },
  { path: '/food-directory', label: 'Food directory', mobile: 'Foods DB', Icon: Apple },
  { path: '/workouts', label: 'Workouts', mobile: 'Gym', Icon: Dumbbell },
  { path: '/library', label: 'Library', mobile: 'Library', Icon: BookOpen },
  { path: '/progress', label: 'Progress', mobile: 'Progress', Icon: ChartNoAxesCombined },
]
