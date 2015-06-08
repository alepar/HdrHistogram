package org.HdrHistogram;

public class DoubleHistogramDto {

    private final DoubleHistogram histogram;

    public DoubleHistogramDto(DoubleHistogram histogram) {
        this.histogram = histogram;
    }

    public double getConfiguredHighestToLowestValueRatio() {
        return histogram.getHighestToLowestValueRatio();
    }

    public int getNumberOfSignificantValueDigits() {
        return histogram.getNumberOfSignificantValueDigits();
    }

    public HistogramDto getIntegerValuesHistogram() {
        return new HistogramDto((Histogram)histogram.integerValuesHistogram);
    }

}