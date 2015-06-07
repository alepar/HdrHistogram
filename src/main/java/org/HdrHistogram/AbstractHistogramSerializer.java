package org.HdrHistogram;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

public class AbstractHistogramSerializer {

    public static class HistogramMixin {

        private final Histogram histogram;

        public HistogramMixin(Histogram histogram) {
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

    }

    public static class DoubleHistogramMixin {

        private final DoubleHistogram histogram;

        public DoubleHistogramMixin(DoubleHistogram histogram) {
            this.histogram = histogram;
        }

        public double getConfiguredHighestToLowestValueRatio() {
            return histogram.getHighestToLowestValueRatio();
        }

        public HistogramMixin getIntegerValuesHistogram() {
            return new HistogramMixin((Histogram)histogram.integerValuesHistogram);
        }

    }

    public static void main(String[] args) throws JsonProcessingException {
        final ObjectMapper mapper = new ObjectMapper();

        final DoubleHistogram histogram = new DoubleHistogram(3);
        histogram.recordValue(10);
        histogram.recordValue(1);

//        histogram.recordValue(345);
//        histogram.recordValue(567);
//        histogram.recordValue(890);

        final String s = mapper.writeValueAsString(new DoubleHistogramMixin(histogram));

        System.out.println(s);

/*
        histogram.recordValueWithCount(100000, 1);
        for (int i=0; i<1000000; i++) {
            histogram.recordValueWithCount(Math.round(Math.random() * 100000), 1);
        }
*/

        histogram.integerValuesHistogram.valueFromIndex(1280);

        for (DoubleHistogramIterationValue value : histogram.linearBucketValues(1)) {
            if (value.getCountAddedInThisIterationStep() > 0) {
                System.out.printf("%.3f %.3f %d\n", value.getPercentileLevelIteratedTo(), value.getValueIteratedTo(), value.getCountAtValueIteratedTo());
            }
        }
    }
}
