import { Github } from "@medusajs/icons"
import { Button, Heading } from "@medusajs/ui"

const Hero = () => {
  return (
    <div className="h-[75vh] w-full border-b border-ui-border-base relative bg-ui-bg-subtle bg-[url(/images/laneige-01.jpg)] bg-cover">
      <div className="absolute inset-0 z-10 flex flex-col justify-center items-center text-center small:p-32 gap-6">
        <span>
          <Heading
            level="h1"
            className="text-3xl leading-10 text-ui-fg-base font-normal"
          >
            Take care of your skin
          </Heading>
          <Heading
            level="h2"
            className="text-3xl leading-10 text-ui-fg-subtle font-normal"
          >
            We will keep you protected all year round.
          </Heading>
        </span>

        <a
          href="http://localhost:8000/gb/store"
          target="_blank"
        >
          <Button className="w-fit mt-16" variant="primary">
            Shop Now
          </Button>
        </a>
      </div>
    </div>
  )
}

export default Hero

