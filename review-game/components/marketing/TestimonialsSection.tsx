interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

const testimonials: Testimonial[] = [
  {
    quote:
      "My students are way more engaged during review days now. The buzzer system makes it feel like a real game show.",
    name: 'Sarah Mitchell',
    role: 'High School Science Teacher',
  },
  {
    quote:
      "I set up my first game in under 10 minutes. Being able to reuse question banks across classes saves me so much time.",
    name: 'James Okafor',
    role: 'Middle School History Teacher',
  },
  {
    quote:
      "The Daily Double feature always gets a reaction. It's the perfect way to reward students who take risks.",
    name: 'Priya Desai',
    role: 'Elementary School Teacher',
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Loved by teachers
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Join thousands of educators making review time the best part of the week.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex flex-col gap-4"
            >
              <p className="text-gray-700 leading-relaxed italic">&ldquo;{testimonial.quote}&rdquo;</p>
              <div className="mt-auto">
                <p className="font-semibold text-gray-900">{testimonial.name}</p>
                <p className="text-sm text-gray-500">{testimonial.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
