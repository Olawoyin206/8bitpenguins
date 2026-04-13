const hre = require("hardhat");

async function main() {
  const BackgroundFactory = await hre.ethers.getContractFactory("PenguinBackgroundSVG");
  const SnowFxFactory = await hre.ethers.getContractFactory("PenguinSnowFxSVG");
  const DotsFxFactory = await hre.ethers.getContractFactory("PenguinDotsFxSVG");
  const TorsoFactory = await hre.ethers.getContractFactory("PenguinTorsoSVG");
  const WingsFactory = await hre.ethers.getContractFactory("PenguinWingsSVG");
  const HeadBaseFactory = await hre.ethers.getContractFactory("PenguinHeadBaseSVG");
  const CapFactory = await hre.ethers.getContractFactory("PenguinCapSVG");
  const BeanieFactory = await hre.ethers.getContractFactory("PenguinBeanieSVG");
  const ScarfFactory = await hre.ethers.getContractFactory("PenguinScarfSVG");
  const HeadbandFactory = await hre.ethers.getContractFactory("PenguinHeadbandSVG");
  const CrownFactory = await hre.ethers.getContractFactory("PenguinCrownSVG");
  const HaloFactory = await hre.ethers.getContractFactory("PenguinHaloSVG");
  const FaceFactory = await hre.ethers.getContractFactory("PenguinFaceSVG");
  const FeetFactory = await hre.ethers.getContractFactory("PenguinFeetSVG");
  const RendererFactory = await hre.ethers.getContractFactory("EightBitPenguinsOnchainRenderer");

  const background = await BackgroundFactory.deploy();
  await background.waitForDeployment();
  const backgroundAddress = await background.getAddress();

  const snowFx = await SnowFxFactory.deploy();
  await snowFx.waitForDeployment();
  const snowFxAddress = await snowFx.getAddress();

  const dotsFx = await DotsFxFactory.deploy();
  await dotsFx.waitForDeployment();
  const dotsFxAddress = await dotsFx.getAddress();

  const torso = await TorsoFactory.deploy();
  await torso.waitForDeployment();
  const torsoAddress = await torso.getAddress();

  const wings = await WingsFactory.deploy();
  await wings.waitForDeployment();
  const wingsAddress = await wings.getAddress();

  const headBase = await HeadBaseFactory.deploy();
  await headBase.waitForDeployment();
  const headBaseAddress = await headBase.getAddress();

  const cap = await CapFactory.deploy();
  await cap.waitForDeployment();
  const capAddress = await cap.getAddress();

  const beanie = await BeanieFactory.deploy();
  await beanie.waitForDeployment();
  const beanieAddress = await beanie.getAddress();

  const scarf = await ScarfFactory.deploy();
  await scarf.waitForDeployment();
  const scarfAddress = await scarf.getAddress();

  const headband = await HeadbandFactory.deploy();
  await headband.waitForDeployment();
  const headbandAddress = await headband.getAddress();

  const crown = await CrownFactory.deploy();
  await crown.waitForDeployment();
  const crownAddress = await crown.getAddress();

  const halo = await HaloFactory.deploy();
  await halo.waitForDeployment();
  const haloAddress = await halo.getAddress();

  const face = await FaceFactory.deploy();
  await face.waitForDeployment();
  const faceAddress = await face.getAddress();

  const feet = await FeetFactory.deploy();
  await feet.waitForDeployment();
  const feetAddress = await feet.getAddress();

  const renderer = await RendererFactory.deploy(
    backgroundAddress,
    snowFxAddress,
    dotsFxAddress,
    torsoAddress,
    wingsAddress,
    headBaseAddress,
    capAddress,
    beanieAddress,
    scarfAddress,
    headbandAddress,
    crownAddress,
    haloAddress,
    faceAddress,
    feetAddress
  );
  await renderer.waitForDeployment();
  const rendererAddress = await renderer.getAddress();

  console.log("Renderer helper deployed");
  console.log("Background:", backgroundAddress);
  console.log("SnowFx:", snowFxAddress);
  console.log("DotsFx:", dotsFxAddress);
  console.log("Torso:", torsoAddress);
  console.log("Wings:", wingsAddress);
  console.log("HeadBase:", headBaseAddress);
  console.log("Cap:", capAddress);
  console.log("Beanie:", beanieAddress);
  console.log("Scarf:", scarfAddress);
  console.log("Headband:", headbandAddress);
  console.log("Crown:", crownAddress);
  console.log("Halo:", haloAddress);
  console.log("Face:", faceAddress);
  console.log("Feet:", feetAddress);
  console.log("Renderer:", rendererAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
