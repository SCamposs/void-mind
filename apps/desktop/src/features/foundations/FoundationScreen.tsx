type FoundationScreenProps = {
  title: string;
  description: string;
};

export function FoundationScreen({ title, description }: FoundationScreenProps) {
  return (
    <section className="foundation-screen">
      <div>
        <span className="quiet-label">Foundation</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}
