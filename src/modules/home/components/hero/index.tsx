import { Github } from "@medusajs/icons"
import { Button, Heading } from "@medusajs/ui"
import SimplePayment from "../simplepayment"

const Hero = () => {
  return (
    <div className="h-[75vh] sm:w-[75vw] m-auto border-b border-ui-border-base relative bg-[#e3e7ef] bg-[url('/images/laneige-02.jpg')] bg-center bg-cover sm:bg-contain sm:bg-right sm:bg-no-repeat ">
      <div className="absolute inset-0 z-10 justify-center m-4 small:p-32 gap-6">
        <div>

          <div className="mt-4">
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
          </div>

          <a
            href="http://localhost:8000/gb/store"
            target="_blank"
          >
            <Button className="w-fit mt-8" variant="primary">
              Shop Now
            </Button>
          </a>
        </div>

        <div className="mt-8">
          <SimplePayment />
        </div>
      </div>

    </div>
  )
}

export default Hero

