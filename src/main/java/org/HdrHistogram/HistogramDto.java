package org.HdrHistogram;

public class HistogramDto {

    private final Histogram histogram;

    public HistogramDto(Histogram histogram) {
        this.histogram = histogram;
    }

    public int getWordSize() {
        return histogram.wordSizeInBytes;
    }

    public int getNormalizingIndexOffset() {
        return histogram.getNormalizingIndexOffset();
    }

    public double getIntegerToDoubleValueConversionRatio() {
        return histogram.getIntegerToDoubleValueConversionRatio();
    }

    public long[] getCounts() {
        return histogram.counts;
    }

    public int getNumberOfSignificantValueDigits() {
        return histogram.getNumberOfSignificantValueDigits();
    }

    public long getLowestDiscernibleValue() {
        return histogram.lowestDiscernibleValue;
    }

    public long getHighestTrackableValue() {
        return histogram.highestTrackableValue;
    }

    public long getMaxValue() {
        return histogram.getMaxValue();
    }

    public long getStartTimeStampMsec() {
        return histogram.getStartTimeStamp();
    }

    public long getEndTimeStampMsec() {
        return histogram.getEndTimeStamp();
    }

}
