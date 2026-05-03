export function FooterBar() {
  return (
    <footer className="border-t border-primary-foreground/20 bg-primary text-center text-sm text-primary-foreground/60 py-4">
      <p>&copy; {new Date().getFullYear()} ConstructPro. All rights reserved.</p>
    </footer>
  )
}
