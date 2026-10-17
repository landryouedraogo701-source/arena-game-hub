import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Games from './pages/Games'
import GameModes from './pages/GameModes'
import Matches from './pages/Matches'
import Lives from './pages/Lives'
import Profile from './pages/Profile'
import Login from './pages/Login'
import Register from './pages/Register'
import CreateMatch from './pages/CreateMatch'
import MatchRoom from './pages/MatchRoom'
import MatchSearch from './pages/MatchSearch'
import TournamentHub from './pages/TournamentHub'
import Championship from './pages/Championship'
import Management from './pages/Management'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/games" element={<Games />} />
        <Route path="/games/:gameName" element={<GameModes />} />

        <Route path="/matches" element={<Matches />} />
        <Route path="/tournaments" element={<TournamentHub />} />
        <Route path="/championship" element={<Championship />} />
        <Route path="/management" element={<Management />} />
        <Route path="/matches/search" element={<MatchSearch />} />
        <Route path="/matches/:id" element={<MatchRoom />} />

        <Route path="/create-match" element={<CreateMatch />} />

        <Route path="/lives" element={<Lives />} />
        <Route path="/profile" element={<Profile />} />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
