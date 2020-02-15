const axios = require('axios');
const fs = require('fs');

axios.defaults.baseURL = 'http://localhost:' + process.env.SERVER_PORT;

// TODO: Test that users can't update or delete segments belonging to others but admins can

// Replace default serializer with one that works with Joi validation
axios.defaults.paramsSerializer = function(params) {
  return qs.stringify(params);
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

jest.setTimeout(10000);

let videoId;

describe('test video api', () => {
  beforeAll(async () => {
    let config = {
      method: 'GET',
      url: '/',
    };

    let ready = false;

    while (!ready) {
      try {
        await axios(config);
        ready = true;
      } catch (err) {
        await sleep(1000);
      }
    }

    console.log('READY');

    config = {
      method: 'POST',
      url: '/login',
      data: {
        email: 'test@user.com',
        password: 'root',
      },
    };

    let { data } = await axios(config);

    ownerId = data.user._id;

    let token = data.refreshToken;

    console.log("REFRESH TOKEN:", token)

    axios.defaults.headers.common.Authorization = 'Bearer ' + token;

    const videoData = JSON.parse(fs.readFileSync('./test/e2e/post-video-1.json'));

    config = {
      method: 'POST',
      url: '/video',
      data: [videoData],
    };

    let response = await axios(config);

    videoId = response.data[0]._id;
  });

  describe('update-video-segments', () => {
    test('can create new segments', async () => {
      expect.assertions(9);

      let config = {
        method: 'POST',
        url: '/update-video-segments',
        data: {
          videoId: '_ok27SPHhwA',
          segments: [
            {
              segmentId: 'aa0a180e-c8ba-4f74-ba52-fd15f3991e4f',
              video: videoId,
              start: 586,
              end: 2307.75,
              title: 'test',
              description: '',
              tags: [
                {
                  rank: 11,
                  tag: {
                    name: 'love',
                  },
                },
                {
                  rank: 6,
                  tag: {
                    name: 'fear',
                  },
                },
              ],
              pristine: false,
            },
            {
              segmentId: 'cf04dfd8-3e4a-4950-8c22-c28f5b35be9a',
              video: videoId,
              start: 553,
              end: 2307.75,
              title: 'test test',
              description: '',
              tags: [
                {
                  rank: 11,
                  tag: {
                    name: 'fear',
                  },
                },
              ],
              pristine: false,
            },
          ],
        },
      };

      const response = await axios(config);

      console.log("DATA:", response.data)

      const segment1 = response.data.filter(
        s => s.segmentId === 'aa0a180e-c8ba-4f74-ba52-fd15f3991e4f'
      )[0];
      const segment2 = response.data.filter(
        s => s.segmentId === 'cf04dfd8-3e4a-4950-8c22-c28f5b35be9a'
      )[0];

      segment1.tags.sort((a, b) => b.rank - a.rank);
      segment2.tags.sort((a, b) => b.rank - a.rank);

      expect(segment1._id).toBeDefined();
      expect(segment1.tags[0].rank).toBe(11);
      expect(segment1.tags[0].tag.name).toBe('love');
      expect(segment1.tags[1].rank).toBe(6);
      expect(segment1.tags[1].tag.name).toBe('fear');

      expect(segment2._id).toBeDefined();
      expect(segment2.tags[0].rank).toBe(11);
      expect(segment2.tags[0].tag.name).toBe('fear');
      expect(segment2.tags[0].tag._id).toBe(segment1.tags[1].tag._id);
    });

    test('can update existing segments', async () => {
      expect.assertions(14);

      let config = {
        method: 'POST',
        url: '/update-video-segments',
        data: {
          videoId: '_ok27SPHhwA',
          segments: [
            {
              segmentId: 'aa0a180e-c8ba-4f74-ba52-fd15f3991e4f',
              video: videoId,
              start: 586,
              end: 2307.75,
              title: 'test',
              description: 'new description',
              tags: [
                {
                  rank: 11,
                  tag: {
                    name: 'fear',
                  },
                },
                {
                  rank: 6,
                  tag: {
                    name: 'love',
                  },
                },
                {
                  rank: 3,
                  tag: {
                    name: 'thought',
                  },
                },
              ],
              pristine: false,
            },
            {
              segmentId: 'cf04dfd8-3e4a-4950-8c22-c28f5b35be9a',
              video: videoId,
              start: 553,
              end: 2330,
              title: 'test2',
              description: '',
              tags: [
                {
                  rank: 11,
                  tag: {
                    name: 'fear',
                  },
                },
              ],
              pristine: false,
            },
          ],
        },
      };

      const response = await axios(config);

      const segment1 = response.data.filter(
        s => s.segmentId === 'aa0a180e-c8ba-4f74-ba52-fd15f3991e4f'
      )[0];
      const segment2 = response.data.filter(
        s => s.segmentId === 'cf04dfd8-3e4a-4950-8c22-c28f5b35be9a'
      )[0];

      segment1.tags.sort((a, b) => b.rank - a.rank);
      segment2.tags.sort((a, b) => b.rank - a.rank);

      expect(segment1._id).toBeDefined();
      expect(segment1.description).toBe('new description');
      expect(segment1.tags[0].rank).toBe(11);
      expect(segment1.tags[0].tag.name).toBe('fear');
      expect(segment1.tags[1].rank).toBe(6);
      expect(segment1.tags[1].tag.name).toBe('love');
      expect(segment1.tags[2].rank).toBe(3);
      expect(segment1.tags[2].tag.name).toBe('thought');

      expect(segment2._id).toBeDefined();
      expect(segment2.end).toBe(2330);
      expect(segment2.title).toBe('test2');
      expect(segment2.tags[0].rank).toBe(11);
      expect(segment2.tags[0].tag.name).toBe('fear');
      expect(segment2.tags[0].tag._id).toBe(segment1.tags[0].tag._id);
    });

    test('can delete segments', async () => {
      expect.assertions(10);

      let config = {
        method: 'POST',
        url: '/update-video-segments',
        data: {
          videoId: '_ok27SPHhwA',
          segments: [
            {
              segmentId: 'aa0a180e-c8ba-4f74-ba52-fd15f3991e4f',
              video: videoId,
              start: 586,
              end: 2307.75,
              title: 'test',
              description: 'new description',
              tags: [
                {
                  rank: 11,
                  tag: {
                    name: 'fear',
                  },
                },
                {
                  rank: 6,
                  tag: {
                    name: 'love',
                  },
                },
                {
                  rank: 3,
                  tag: {
                    name: 'thought',
                  },
                },
              ],
              pristine: true,
            }
          ],
        },
      };

      const response = await axios(config);

      const segment1 = response.data.filter(
        s => s.segmentId === 'aa0a180e-c8ba-4f74-ba52-fd15f3991e4f'
      )[0];
      const segment2 = response.data.filter(
        s => s.segmentId === 'cf04dfd8-3e4a-4950-8c22-c28f5b35be9a'
      )[0];

      segment1.tags.sort((a, b) => b.rank - a.rank);

      expect(segment1._id).toBeDefined();
      expect(segment1.description).toBe('new description');
      expect(segment1.tags[0].rank).toBe(11);
      expect(segment1.tags[0].tag.name).toBe('fear');
      expect(segment1.tags[1].rank).toBe(6);
      expect(segment1.tags[1].tag.name).toBe('love');
      expect(segment1.tags[2].rank).toBe(3);
      expect(segment1.tags[2].tag.name).toBe('thought');

      expect(segment2).not.toBeDefined();

      expect(response.data.length).toBe(1);
    });
  });
});
