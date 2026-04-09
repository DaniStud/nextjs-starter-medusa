import Image from "next/image"

const Hero = () => {
  return (
    <div className="mb-12 w-full max-w-[90vw] md:max-w-[66vw] mx-auto mt-32 min-h-[66vh] border-b border-ui-border-base flex flex-col small:flex-row small:grid small:grid-cols-2">
      {/* Left Column – Content Pane */}
      <div className="flex flex-col items-center justify-center p-8 bg-white min-h-[50vh] small:min-h-0">
        <h1 className="text-3xl small:text-5xl font-normal text-black mb-4 text-center">
          10-shirts
        </h1>
        <p className="text-base text-gray-800 max-w-md text-center mb-8">
          Premium quality essentials — curated for everyday style.
        </p>
        <a
          href="https://www.10-shirts.dk/dk/store"
          target="_blank"
        >
          <button className="border border-black text-black px-8 py-3 text-sm font-medium hover:bg-gray-50 transition-colors">
            Shop Nu
          </button>
        </a>
      </div>

      {/* Right Column – Image Pane */}
      <div className="relative w-full overflow-hidden min-h-[50vh] small:min-h-0 max-h-[900px]">
        <Image
          src="/images/panda-foto1.png"
          alt="Hero"
          fill
          className="object-cover object-center"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
        />
      </div>
    </div>
  )


}

export default Hero
