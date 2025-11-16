
const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="h-screen flex items-center justify-center" style={{ 
          background: 'radial-gradient(circle at center, #7c3aed 0%, #0b0b0b 70%)',
        }}>
        {children}
    </div>
  )
}

export default AuthLayout