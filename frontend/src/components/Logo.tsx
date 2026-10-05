import logo from '../assets/logo.svg'

export function Logo({ className = '' }: { className?: string }) {
  return <img src={logo} alt="Projeto Aurora" className={`logo-adaptavel ${className}`} />
}
