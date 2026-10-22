const prisma = require('../../shared/prisma');

const saveScanHistory = async (userId, { fishImage, disease, confidence, description, treatment, validation }) => {
  const created = await prisma.scanHistory.create({
    data: {
      userId,
      fishImage,
      disease,
      confidence,
      description,
      treatment,
      validation: validation ?? null,
      scanTimestamp: new Date(),
    },
  });

  return {
    imageUrl: created.fishImage,
    fishName: created.disease,
    accuracy: created.confidence,
  };
};

const toScanShape = ({ id, userId, fishImage, disease, confidence, description, treatment, validation, scanTimestamp }) => ({
  id,
  userId,
  fishImage,
  disease,
  confidence: Number(confidence),
  description,
  treatment,
  validation,
  scanTimestamp,
});

const getScanHistoriesByUserId = async (userId) => {
  const histories = await prisma.scanHistory.findMany({
    where: { userId },
    orderBy: { scanTimestamp: 'desc' },
  });
  return histories.map(toScanShape);
};

module.exports = { saveScanHistory, getScanHistoriesByUserId };
